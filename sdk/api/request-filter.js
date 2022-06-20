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

import {BlockingFilter, AllowingFilter}
  from "adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {parseURL} from "adblockpluscore/lib/url.js";

import {filterEngine} from "./core.js";
import {getFrameInfo, isTopLevelFrameId} from "./frame-state.js";
import {ignoreNoConnectionError} from "../errors.js";
import {logItem} from "./diagnostics.js";
import {getSitekey, setSitekeyFromHeaders} from "./sitekey.js";

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
    // Chrome calls it initiator, Firefox calls it documentUrl
    return details.initiator || details.documentUrl;
  }

  getFrameInfo(details) {
    if (details.type == "sub_frame")
      return getFrameInfo(details.tabId, details.parentFrameId);
    return getFrameInfo(
      details.tabId,
      details.frameId,
      details.parentFrameId,
      this.getInitiator(details)
    );
  }

  getContentType(details) {
    let contentType = resourceTypes.get(details.type) || contentTypes.OTHER;
    if (contentType == contentTypes.DOCUMENT)
      return contentTypes.OTHER;
    return contentType;
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

    let filter = filterEngine.defaultMatcher.match(
      details.url, this.getContentType(details),
      docDomain, frame.sitekey, specificOnly, true);
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

    let frame = this.getFrameInfo(details);
    if (!frame)
      return;

    let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
    if (frame.allowlisted & contentTypes.DOCUMENT) {
      return this.allow(details, frame.allowingDocumentFilter, {
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
    let matchInfo = {docDomain, specificOnly, method: "header"};
    let matcher = filterEngine.defaultMatcher;

    let typeMask = contentTypes.HEADER | this.getContentType(details);
    let allowingFilter = matcher.match(details.url, typeMask, docDomain,
                                       frame.sitekey, specificOnly, true);

    if (allowingFilter && allowingFilter instanceof AllowingFilter)
      return this.allow(details, allowingFilter, matchInfo);

    let matches = matcher.search(details.url, typeMask, docDomain,
                                 frame.sitekey, specificOnly, "blocking");

    let filter = matches.blocking.find(blockingFilter => {
      return blockingFilter.filterHeaders(details.responseHeaders);
    });

    if (filter)
      return this.block(details, filter, matchInfo);
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
  filter(details) {
    let {requestId, tabId, frameId, parentFrameId, responseHeaders, url, type} =
        details;

    if (pendingAllowlistedRequests.has(requestId))
      return;

    let initiator = this.getInitiator(details);
    if (initiator && initiator.startsWith(EXTENSION_PROTOCOL)) {
      // These are requests sent by an extension, so if we block these
      // we could block our own ability to update subscriptions etc.
      return this.allow(details, null, {
        method: "allowing", allowingReason: "extensionInitiated"
      });
    }

    let parentFrame = getFrameInfo(tabId, parentFrameId);
    let {hostname: parentHostname, sitekey: parentSitekey} = parentFrame || {};
    let matcher = filterEngine.defaultMatcher;

    let urlInfo = parseURL(url);
    let hostname = parentHostname || urlInfo.hostname;
    let sitekey = setSitekeyFromHeaders(
      tabId, frameId, url, responseHeaders
    ) || parentSitekey;

    let specificOnlyFilter = matcher.match(
      url, contentTypes.GENERICBLOCK, hostname, sitekey
    );
    let documentFilter = matcher.match(
      url, contentTypes.DOCUMENT, hostname, sitekey
    );
    let specificOnly = !!specificOnlyFilter;

    if (documentFilter) {
      return this.allow(details, documentFilter, {
        docDomain: this.getDocDomain(type, urlInfo.hostname),
        method: "allowing",
        specificOnly
      });
    }

    let docDomain =
      this.getDocDomain(type, parentHostname);
    let typeMask = contentTypes.CSP | this.getContentType(details);
    let matchInfo = {docDomain: docDomain || urlInfo.hostname,
                     specificOnly, method: "csp"};

    let allowingFilter = matcher.match(url, typeMask, docDomain,
                                       sitekey, specificOnly, true);
    if (allowingFilter && allowingFilter instanceof AllowingFilter)
      return this.allow(details, allowingFilter, matchInfo);

    let matches = matcher.search(url, typeMask, docDomain,
                                 sitekey, specificOnly, "blocking");

    if (matches.blocking.length > 0) {
      pendingCspRequests.add(requestId);
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
    let {requestId, tabId, frameId, parentFrameId, url, type} = details;
    let wasAllowlisted = pendingAllowlistedRequests.delete(requestId);
    let wasCsp = pendingCspRequests.delete(requestId);
    if (wasAllowlisted || wasCsp)
      return;

    if (type == "main_frame" || type == "sub_frame") {
      // for these two types, it's unreliable if frame is there or not
      // yet. The request could be completed before or after the new
      // frame is committed.
      let parentFrame = getFrameInfo(tabId, parentFrameId);
      let {hostname: parentHostname, sitekey: parentSitekey} =
          parentFrame || {};

      let urlInfo = parseURL(url);
      let hostname = parentHostname || urlInfo.hostname;
      let sitekey = getSitekey(tabId, frameId, url) || parentSitekey;
      let matcher = filterEngine.defaultMatcher;
      let specificOnlyFilter = matcher.match(
        url, contentTypes.GENERICBLOCK, hostname, sitekey
      );
      let specificOnly = !!specificOnlyFilter;

      if (isTopLevelFrameId(frameId)) {
        let popupFilter = matcher.match(
          url, contentTypes.POPUP, hostname, sitekey, specificOnly
        );
        if (popupFilter)
          return;
      }
      let matchInfo = {
        docDomain: this.getDocDomain(type, hostname),
        method: "unmatched",
        specificOnly
      };
      logItem(details, null, matchInfo);
    }
    else {
      let frame = this.getFrameInfo(details);
      if (!frame)
        return;

      let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
      let matchInfo = {
        docDomain: this.getDocDomain(type, frame.hostname),
        method: "unmatched",
        specificOnly
      };
      logItem(details, null, matchInfo);
    }
  }
}

RequestCompletionFilter.prototype.event = browser.webRequest.onCompleted;
RequestCompletionFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  }
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
