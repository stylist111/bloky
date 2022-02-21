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

import {BlockingFilter} from "adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {defaultMatcher as matcher} from "adblockpluscore/lib/matcher.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";

import {getFrameInfo} from "./frame-state.js";
import {ignoreNoConnectionError} from "../errors.js";
import {logItem} from "./diagnostics.js";

const EXTENSION_PROTOCOL = new URL(browser.runtime.getURL("")).protocol;

export let resourceTypes = new Map();
for (let type in contentTypes)
  resourceTypes.set(type.toLowerCase(), contentTypes[type]);
resourceTypes.set("sub_frame", contentTypes.SUBDOCUMENT);
resourceTypes.set("beacon", contentTypes.PING);
resourceTypes.set("imageset", contentTypes.IMAGE);
resourceTypes.set("object_subrequest", contentTypes.OBJECT);
resourceTypes.set("main_frame", contentTypes.DOCUMENT);

let typeSelectors = new Map([
  [contentTypes.IMAGE, "img,input"],
  [contentTypes.MEDIA, "audio,video"],
  [contentTypes.SUBDOCUMENT, "frame,iframe,object,embed"],
  [contentTypes.OBJECT, "object,embed"]
]);

let pendingAllowlistedRequests = new Set();
let pendingCspRequests = new Set();

class RequestFilter {
  register() {
    if (!this.listener) {
      this.listener = this.filter.bind(this);
      this.event.addListener(this.listener, ...this.eventArgs);
    }
  }

  unregister() {
    if (this.listener) {
      this.event.removeListener(this.listener);
      this.listener = null;
    }
  }

  getFrameId(details) {
    return details.type == "sub_frame" ? details.parentFrameId :
                                         details.frameId;
  }

  getDocDomain(type, hostname) {
    return type == "main_frame" ? null : hostname;
  }

  getInitiator(details) {
    return details.initiator || details.documentUrl;
  }

  getFrameInfo(details, initiator) {
    return getFrameInfo(details.tabId, this.getFrameId(details), initiator);
  }

  getContentType(details) {
    return resourceTypes.get(details.type) || contentTypes.OTHER;
  }

  collapse(details) {
    let selector = typeSelectors.get(this.getContentType(details));
    let frameId = this.getFrameId(details);

    let sendCollapseMessage = () => {
      return browser.tabs.sendMessage(
        details.tabId,
        {type: "ewe:collapse", selector, url: details.url}, {frameId}
      );
    };

    if (selector && frameId != -1) {
      // Retrying to fix a connection error on Chromium 90
      sendCollapseMessage()
        .catch(() => ignoreNoConnectionError(sendCollapseMessage()));
    }
  }

  block(details, filter, matchInfo) {
    let value = (() => {
      if (typeof filter.rewrite == "string") {
        let rewrittenUrl = filter.rewriteUrl(details.url);
        // If no rewrite happened (error, different origin), we'll
        // return undefined in order to avoid an "infinite" loop.
        if (rewrittenUrl != details.url) {
          matchInfo.rewrittenUrl = rewrittenUrl;
          return {redirectUrl: rewrittenUrl};
        }
      }
      else {
        this.collapse(details);
        return {cancel: true};
      }
    })();
    logItem(details, filter, matchInfo);
    return value;
  }

  allow(details, filter, matchInfo) {
    pendingAllowlistedRequests.add(details.requestId);
    logItem(details, filter, matchInfo);
  }

  match(details, frame, specificOnly) {
    let docDomain = this.getDocDomain(details.type, frame.hostname);
    // This currently needs to be matcher.search because matcher.match
    // will only return an allowing filter if it's overriding a
    // blocking filter. Unfortunately, the current design doesn't
    // consider the potential of header filters being checked in a
    // later stage. Using search may have performance implications, so
    // this should be changed back to using matcher.match after
    // https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/392
    // is resolved.
    let matches = matcher.search(details.url, this.getContentType(details),
                                 docDomain, frame.sitekey, specificOnly);
    let filter = matches.allowing[0] || matches.blocking[0];
    if (filter) {
      let matchInfo = {docDomain, specificOnly, method: "request"};
      if (filter instanceof BlockingFilter)
        return this.block(details, filter, matchInfo);
      return this.allow(details, filter, matchInfo);
    }
  }

  filter(details) {
    if (pendingAllowlistedRequests.has(details.requestId))
      return;

    let initiator = this.getInitiator(details);
    if (initiator && initiator.startsWith(EXTENSION_PROTOCOL)) {
      // These are requests sent by an extension, so if we block these
      // we could block our own ability to update subscriptions etc.
      return this.allow(details, null, {
        method: "allowing", allowingReason: "extensionInitiated"
      });
    }

    let frame = this.getFrameInfo(details, initiator);
    if (!frame)
      return;

    let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
    if (frame.allowlisted & contentTypes.DOCUMENT) {
      return this.allow(details, null, {
        docDomain: this.getDocDomain(details.type, frame.hostname),
        method: "allowing",
        specificOnly
      });
    }

    return this.match(details, frame, specificOnly);
  }
}

RequestFilter.prototype.event = browser.webRequest.onBeforeRequest;
RequestFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType)
                 .filter(type => type != "main_frame"),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  },
  ["blocking"]
];

class HeaderFilter extends RequestFilter {
  match(details, frame, specificOnly) {
    let docDomain = this.getDocDomain(details.type, frame.hostname);
    let matches = matcher.search(details.url, contentTypes.HEADER,
                                 docDomain, frame.sitekey,
                                 specificOnly);

    let filter = (() => {
      // You might think that we should call filterHeaders on the
      // allowing filter too, but actually filterHeaders is only on
      // blocking filters
      if (matches.allowing.length > 0)
        return matches.allowing[0];

      for (let blockingFilter of matches.blocking) {
        if (blockingFilter.filterHeaders(details.responseHeaders))
          return blockingFilter;
      }
    })();

    if (filter) {
      let matchInfo = {docDomain, specificOnly, method: "header"};
      if (filter instanceof BlockingFilter)
        return this.block(details, filter, matchInfo);
      return this.allow(details, filter, matchInfo);
    }
  }
}

HeaderFilter.prototype.event = browser.webRequest.onHeadersReceived;
HeaderFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType)
                 .filter(type => type != "main_frame"),
    urls: ["http://*/*", "https://*/*"]
  },
  ["blocking", "responseHeaders"]
];

class CSPFilter extends RequestFilter {
  getFrameInfo(details, initiator) {
    let frame = getFrameInfo(details.tabId, details.frameId);
    return frame.pending || frame;
  }

  match(details, frame, specificOnly) {
    let parentFrame = getFrameInfo(details.tabId, details.parentFrameId);
    let docDomain = this.getDocDomain(details.type,
                                      parentFrame && parentFrame.hostname);
    let matchInfo = {docDomain: docDomain || frame.hostname,
                     specificOnly, method: "csp"};

    let {responseHeaders} = details;
    let matches = matcher.search(details.url, contentTypes.CSP, docDomain,
                                 frame.sitekey, specificOnly);

    if (matches.allowing.length > 0) {
      let filter = matches.allowing[0];
      return this.allow(details, filter, matchInfo);
    }

    if (matches.blocking.length > 0) {
      pendingCspRequests.add(details.requestId);
      for (let filter of matches.blocking) {
        logItem(details, filter, matchInfo);
        responseHeaders.push(
          {name: "Content-Security-Policy", value: filter.csp}
        );
      }
    }

    return {responseHeaders};
  }
}

CSPFilter.prototype.event = browser.webRequest.onHeadersReceived;
CSPFilter.prototype.eventArgs = [
  {
    types: ["main_frame", "sub_frame"],
    urls: ["http://*/*", "https://*/*"]
  },
  ["blocking", "responseHeaders"]
];

class RequestCompletionFilter extends RequestFilter {
  filter(details) {
    let wasAllowlisted = pendingAllowlistedRequests.delete(details.requestId);
    let wasCsp = pendingCspRequests.delete(details.requestId);
    if (wasAllowlisted || wasCsp)
      return;

    let initiator = this.getInitiator(details);
    let frame = this.getFrameInfo(details, initiator);
    if (!frame)
      return;

    let pending = frame.pending || frame;
    let specificOnly = (pending.allowlisted & contentTypes.GENERICBLOCK) != 0;

    if (details.frameId == 0) {
      let popupFilter = matcher.match(
        details.url, contentTypes.POPUP,
        frame.hostname, frame.sitekey, specificOnly
      );
      if (popupFilter)
        return;
    }
    let matchInfo = {
      docDomain: this.getDocDomain(details.type, pending.hostname),
      method: "unmatched",
      specificOnly
    };
    logItem(details, null, matchInfo);
  }
}

RequestCompletionFilter.prototype.event = browser.webRequest.onCompleted;
RequestCompletionFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  },
  []
];

class RequestErrorFilter extends RequestFilter {
  filter(details) {
    pendingAllowlistedRequests.delete(details.requestId);
    pendingCspRequests.delete(details.requestId);
  }
}

RequestErrorFilter.prototype.event = browser.webRequest.onErrorOccurred;
RequestErrorFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  }
];

let filters = browser.declarativeNetRequest ? [] : [
  new RequestFilter(),
  new HeaderFilter(),
  new CSPFilter(),
  new RequestCompletionFilter(),
  new RequestErrorFilter()
];

function onBeforeNavigate() {
  browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  browser.webRequest.handlerBehaviorChanged();
}

function onFilterChange() {
  browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
}

const FILTER_EVENTS = ["subscription.added",
                       "subscription.removed",
                       "subscription.updated",
                       "subscription.disabled",
                       "filter.added",
                       "filter.removed",
                       "filterState.enabled"];

export function start() {
  for (let filter of filters)
    filter.register();

  for (let event of FILTER_EVENTS) {
    if (!filterNotifier.listeners(event).includes(onFilterChange))
      filterNotifier.on(event, onFilterChange);
  }
}

export function stop() {
  for (let filter of filters)
    filter.unregister();

  for (let event of FILTER_EVENTS)
    filterNotifier.off(event, onFilterChange);
}
