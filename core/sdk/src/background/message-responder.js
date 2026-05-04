/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";

import {fromSerializableError} from "../all/errors.js";
import {default as initializer} from "./initializer.js";
import {applyContentFilters, injectCSS} from "./content-filter.js";
import {createStyleSheet} from "#adblockpluscore/lib/elemHide.js";
import {contentTypes} from "#adblockpluscore/lib/contentTypes.js";
import {getBaseDomain} from "#adblockpluscore/lib/url.js";
import {subscribeLinkClicked} from "./subscribe-links.js";
import {logHiddenElements, logItem} from "./diagnostics.js";
import {allowlistPage} from "./allowlisting.js";
import {debugOptions, trace} from "./debugging.js";
import {onContentHelloReceived} from "./content-message-deferrer.js";
import {markActive, countBTAADetectionEvent, countWallDetectionEvent}
  from "./cdp/index.js";
import {default as sentry} from "./sentry.js";
import {serverLogValidatedEvent} from "./telemetry/server-logger.js";
import {isSnippetEventDuplicate} from "./telemetry/snippet-event-dedup.js";
import {handleMessageAPICall} from "./message-invoked-api.js";
import {onHistoryStateUpdatedSafari} from "./safari-polyfill.js";
import {filterEngine} from "./core.js";
import {getFrameInfo, TOP_LEVEL_FRAME_ID} from "./frame-state.js";
import {default as experiments} from "./experiments.js";
import {default as lightningSnippets} from "./lightning-snippets.js";

// Detection types with this prefix count in CDP domain stats (ds path).
const WALL_TYPE_PREFIX = "wall-";

async function handleMessage(message, sender) {
  trace({
    message, sender: {
      tabId: sender.tab ? sender.tab.id : null,
      frameId: sender.frameId,
      url: sender.url
    }
  });
  await initializer.start();
  switch (message.type) {
    case "ewe:content-hello":
      // Firefox mistakenly runs content scripts in non-web page context,
      // it does not happen in Chrome.
      // https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/174.
      // Messages sent from a non-web page context do not have an
      // associated tab and can be ignored.
      if (!sender.tab) {
        return;
      }

      onContentHelloReceived(sender.tab.id, sender.frameId);
      let filterData = await applyContentFilters(sender.tab.id, sender.frameId);
      return {...filterData};
    case "ewe:subscribe-link-clicked":
      subscribeLinkClicked(message.url, message.title);
      break;
    case "ewe:trace-elem-hide":
      logHiddenElements(message.selectors, message.filters, sender);
      break;
    case "ewe:inject-css":
      let styleSheet = createStyleSheet([message.selector]);
      injectCSS(sender.tab.id, sender.frameId, styleSheet);
      break;
    case "ewe:allowlist-page":
      const {timestamp, signature, options} = message;
      return allowlistPage(
        sender.tab.id, sender.frameId, timestamp, signature, options
      );
    case "ewe:cdp-session-active":
      await markActive(sender.tab.id, sender.frameId);
      break;
    case "ewe:blockthrough-acceptable-ads-detection-event":
      countBTAADetectionEvent(sender.tab.url, message.details);
      break;
    case "ewe:sentry-error":
      const error = fromSerializableError(message.error);
      sentry.reportError(error);
      break;
    case "ewe:telemetry-log": {
      let keySuffix;
      if (message.event === "snippet_detection_event" && message.data) {
        const domain = getBaseDomain(message.data.domain)
          || message.data.domain;
        if (isSnippetEventDuplicate(message.data.type, domain)) {
          break;
        }
        keySuffix = `${message.data.type}:${domain}`;
        if (message.data.type.startsWith(WALL_TYPE_PREFIX)) {
          countWallDetectionEvent(domain);
        }
      }
      else if (message.event === "snippet_hit_event" && message.data) {
        const domain = getBaseDomain(message.data.domain)
          || message.data.domain;
        const topLevelDomain =
          getBaseDomain(message.data.topLevelDomain)
          || message.data.topLevelDomain;
        keySuffix = `${message.data.filter}:${domain}:${topLevelDomain}`;
      }
      serverLogValidatedEvent(
        message.logTime,
        message.module,
        message.level,
        message.event,
        message.data,
        keySuffix
      );
      break;
    }
    case "ewe:api-call":
      const {apiName, methodName, params} = message;
      return await handleMessageAPICall(apiName, methodName, params);
    case "ewe:safari-onhistorystateupdated":
      onHistoryStateUpdatedSafari(sender.tab.id, sender.frameId, message.event);
      break;
    case "ewe:get-filters-config": {
      const frame = getFrameInfo(sender.tab.id, sender.frameId);
      const topFrame = getFrameInfo(sender.tab.id, TOP_LEVEL_FRAME_ID);
      const hostname = frame.hostname;
      const [experimentHosts, isEnabled] = await Promise.all([
        experiments.getFlag("zero-delay-snippet-domains"),
        lightningSnippets.isEnabled()
      ]);
      const request = {
        tabId: sender.tab.id,
        frameId: sender.frameId,
        url: frame.url
      };

      // `useCache` activates Lightning Snippets (zero-delay filter caching)
      // for this frame. It composes two independent sources:
      //   - lightningSnippets.isEnabled(): resolved global state from the
      //     caller-opinion / premium-status / host-default precedence
      //     chain (see the lightningSnippets namespace).
      //   - zero-delay-snippet-domains: a per-host activation list in the
      //     experiment config, independent of global state.
      const defaultFiltersConfig = {
        // If true, content scripts will mark visually the elements hidden
        debug: debugOptions.elemHide,
        // If true, content scripts will apply the filters from the local cache
        // first, and if there are changes will update the cache and refresh
        // the page.
        useCache: isEnabled || Boolean(
          experimentHosts && experimentHosts.includes(hostname)
        ),
        // If true, isolated snippets will fire
        // snippet_detection_event telemetry
        detectionEventEnabled: Boolean(
          await experiments.getFlag("snippet-detection-event")
        ),
        hitEventEnabled: Boolean(
          await experiments.getFlag("snippet-hit-event-cdp")
        ),
        detectionDomainlessEventEnabled: Boolean(
          await experiments.getFlag("snippet-detection-domainless")
        ),
        topLevelHostname: topFrame ? topFrame.hostname : null
      };

      // If the document is allowlisted, no filters should be applied.
      if (frame.allowlisted & contentTypes.DOCUMENT) {
        return {
          ...defaultFiltersConfig,
          filters: []
        };
      }

      const snippetFilters = filterEngine.snippets.getFilters(hostname);

      // Asynchronously log snippet filters This needs to be wrapped in a
      // promise callback so that we don't block the current execution context,
      // and rather returns as soon as possible.
      void Promise.resolve().then(() => {
        snippetFilters.forEach(filter =>
          logItem(request, filter, {
            docDomain: frame.hostname,
            method: "snippet"
          })
        );
      });

      return {
        ...defaultFiltersConfig,
        filters: snippetFilters.map(snippetItem => snippetItem.body)
      };
    }
  }
}

function onMessage(message, sender) {
  if (typeof message == "object" && message != null &&
      message.type && message.type.startsWith("ewe:")) {
    return handleMessage(message, sender);
  }
  return false;
}

/**
 * Start the message responder module. In MV3, this must be called in
 * the first turn of the event loop.
 */
export function start() {
  browser.runtime.onMessage.addListener(onMessage);
}
