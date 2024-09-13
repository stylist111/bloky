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

import {logItem, loggingEnabled} from "./diagnostics.js";
import {filterEngine} from "./core.js";
import {default as initializer} from "./initializer.js";
import {getRequestContentType, getFrameInfoFromWebrequestDetails,
        getParentFrameInfoFromWebrequestDetails, sanitizeInitiator}
  from "./request-filter.js";

import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {BlockingFilter, AllowingFilter}
  from "adblockpluscore/lib/filterClasses.js";
import {parseURL} from "adblockpluscore/lib/url.js";
import {trace} from "./debugging.js";

function getContext(details) {
  let contentType = getRequestContentType(details);

  if (details.type == "main_frame" || details.type == "sub_frame") {
    let parentFrame = getParentFrameInfoFromWebrequestDetails(details);
    let {hostname: parentHostname} = parentFrame || {};
    let initiator = details.documentUrl || sanitizeInitiator(details.initiator);
    // In cross-origin requests, Chrome's initiator has the correct url domain
    let urlInfo = parseURL(initiator || details.url);
    let hostname = parentHostname || urlInfo.hostname;

    let docDomain = details.type == "main_frame" ? null : hostname;

    let specificOnlyFilter = filterEngine.defaultMatcher.match(
      details.url, contentTypes.GENERICBLOCK, hostname, null
    );
    let allowingDocumentFilter = filterEngine.defaultMatcher.match(
      details.url, contentTypes.DOCUMENT, hostname, null
    );
    if (!allowingDocumentFilter && parentFrame &&
        parentFrame.allowingDocumentFilter) {
      allowingDocumentFilter = parentFrame.allowingDocumentFilter;
    }

    let specificOnly = !!specificOnlyFilter;

    return {
      allowingDocumentFilter,
      specificOnly,
      docDomain,
      contentType
    };
  }

  let frame = getFrameInfoFromWebrequestDetails(details);
  if (!frame) {
    let allowingDocumentFilter = null;
    let specificOnly = false;
    let docDomain = null;

    let documentUrl = details.documentUrl ||
        sanitizeInitiator(details.initiator);
    if (documentUrl) {
      let urlInfo = parseURL(documentUrl);
      docDomain = urlInfo.hostname;

      allowingDocumentFilter = filterEngine.defaultMatcher.match(
        documentUrl, contentTypes.DOCUMENT, docDomain, null
      );

      specificOnly = Boolean(filterEngine.defaultMatcher.match(
        documentUrl, contentTypes.GENERICBLOCK, docDomain, null
      ));
    }

    return {
      allowingDocumentFilter,
      specificOnly,
      docDomain,
      contentType
    };
  }

  let allowingDocumentFilter = frame.allowingDocumentFilter;
  let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
  let docDomain = frame.hostname;

  return {
    allowingDocumentFilter,
    specificOnly,
    docDomain,
    contentType
  };
}

async function onBeforeRedirect(details) {
  trace({details});

  if (!loggingEnabled(details.tabId)) {
    return;
  }

  await initializer.start();

  if (!details.redirectUrl.startsWith("data:")) {
    return;
  }

  let {
    allowingDocumentFilter,
    specificOnly,
    docDomain,
    contentType
  } = getContext(details);

  if (allowingDocumentFilter) {
    // Our filters would have allowlisted this, so the redirect isn't
    // our filters. Nothing to log here.
    return;
  }

  let potentialFilters = filterEngine.defaultMatcher.search(
    details.url, contentType, docDomain, null, specificOnly, "blocking"
  );
  for (let filter of potentialFilters.blocking) {
    if (filter instanceof BlockingFilter && typeof filter.rewrite == "string") {
      let rewrittenUrl = filter.rewriteUrl(details.url);
      if (rewrittenUrl == details.redirectUrl) {
        let matchInfo = {
          docDomain, specificOnly, method: "request", rewrittenUrl
        };
        logItem(details, filter, matchInfo);
        return;
      }
    }
  }
}

async function onErrorOccurred(details) {
  trace({details});

  if (!loggingEnabled(details.tabId)) {
    return;
  }

  await initializer.start();

  let {
    allowingDocumentFilter,
    specificOnly,
    docDomain,
    contentType
  } = getContext(details);

  if (allowingDocumentFilter) {
    // Our filters would have allowlisted this, so the error event
    // isn't from our filters blocking something. Nothing to log here.
    return;
  }

  let potentialFilters = filterEngine.defaultMatcher.search(
    details.url, contentType, docDomain, null, specificOnly, "blocking"
  );
  for (let filter of potentialFilters.blocking) {
    let matchInfo = {docDomain, specificOnly, method: "request"};
    if (filter instanceof BlockingFilter && typeof filter.rewrite != "string") {
      logItem(details, filter, matchInfo);
      return;
    }
  }
}

async function onCompleted(details) {
  trace({details});

  if (!loggingEnabled(details.tabId)) {
    return;
  }

  await initializer.start();

  let {
    allowingDocumentFilter,
    specificOnly,
    docDomain,
    contentType
  } = getContext(details);

  if (allowingDocumentFilter) {
    logItem(details, allowingDocumentFilter, {
      docDomain,
      method: "allowing",
      specificOnly
    });
    return;
  }

  let filter = filterEngine.defaultMatcher.match(
    details.url, contentType, docDomain, null, specificOnly, true
  );
  if (filter) {
    let matchInfo = {docDomain, specificOnly, method: "request"};
    if (filter instanceof AllowingFilter) {
      logItem(details, filter, matchInfo);
    }
    return;
  }

  if (details.type == "main_frame" || details.type == "sub_frame") {
    // CSP filters could apply in this case

    let cspTypeMask = contentTypes.CSP | getRequestContentType(details);
    let hostname = parseURL(details.url).hostname;
    let cspMatchInfo = {docDomain: docDomain || hostname,
                        specificOnly, method: "csp"};

    let allowingCspFilter = filterEngine.defaultMatcher.match(
      details.url, cspTypeMask, docDomain, null, specificOnly, true
    );
    if (allowingCspFilter && allowingCspFilter instanceof AllowingFilter) {
      logItem(details, allowingCspFilter, cspMatchInfo);
      return;
    }

    let cspFilters = filterEngine.defaultMatcher.search(
      details.url, cspTypeMask, hostname, null, specificOnly, "blocking"
    );

    let appliedCspFilters = false;
    for (let cspFilter of cspFilters.blocking) {
      let cspFilterWasApplied = details.responseHeaders.some(header => {
        return header.name.toLowerCase() == "content-security-policy" &&
          header.value == cspFilter.csp;
      });
      if (cspFilterWasApplied) {
        logItem(details, cspFilter, cspMatchInfo);
        appliedCspFilters = true;
      }
    }

    if (appliedCspFilters) {
      return;
    }
  }

  let matchInfo = {
    docDomain,
    method: "unmatched",
    specificOnly
  };
  logItem(details, null, matchInfo);
}

let started = false;

/**
 * Starts listening for filters to log onBlockableItem events. Actual
 * blocking should be done using the declarativeNetRequest API.
 */
export function start() {
  if (!browser.declarativeNetRequest || started) {
    return;
  }

  let eventArgs = {
    types: Object.values(browser.webRequest.ResourceType),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  };

  browser.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, eventArgs);
  browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, eventArgs);
  browser.webRequest.onCompleted.addListener(onCompleted, eventArgs, ["responseHeaders"]);

  started = true;
}
