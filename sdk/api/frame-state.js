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

import {parseURL} from "adblockpluscore/lib/url.js";
import {defaultMatcher as matcher} from "adblockpluscore/lib/matcher.js";
import {ALLOWING_TYPES, contentTypes}
  from "adblockpluscore/lib/contentTypes.js";

import {logItem} from "./diagnostics.js";
import {getSitekey, setSitekeyFromHeaders, clearAllSitekeys, clearTabSitekeys}
  from "./sitekey.js";

let state = new Map();
let startupPromise;

class FrameInfo {
  constructor(tabId, frameId, parent, url) {
    let {
      allowlisted: parentAllowlisted,
      sitekey: parentSitekey,
      allowingDocumentFilter: parentAllowingDocumentFilter
    } = parent || {};

    let urlInfo = parseURL(url);

    this.url = url;
    this.hostname = urlInfo.hostname || (parent ? parent.hostname : "");
    this.sitekey = getSitekey(tabId, frameId, url) || parentSitekey;
    this.parent = parent;

    // allowlisted and allowingDocumentFilter start with their parent
    // value, but may have extra allowing filters added when we call
    // findAllowlistingFilters
    this.allowlisted = parentAllowlisted || 0;
    this.allowingDocumentFilter = parentAllowingDocumentFilter;

    findAllowlistingFilters(this, tabId, frameId);
  }
}

function getAllowingReason(typeMask, filter) {
  for (let type in contentTypes) {
    if (typeMask & filter.contentType & contentTypes[type])
      return type.toLowerCase();
  }
}

function findAllowlistingFilters(frame, tabId, frameId) {
  let details = {tabId, frameId, url: frame.url};
  // The docDomain for a frame is the hostname of the parent frame
  // (the loader). For top-level frames we use the current URL's hostname.
  let parentHostname = frame.parent && frame.parent.hostname;
  let matchInfo = {docDomain: parentHostname || frame.hostname,
                   method: "allowing"};

  while (true) {
    let typeMask = ~frame.allowlisted & ALLOWING_TYPES;
    let filter = matcher.match(
      frame.url, typeMask, matchInfo.docDomain, frame.sitekey
    );

    if (!filter)
      break;

    frame.allowlisted |= filter.contentType & ALLOWING_TYPES;
    if (filter.contentType & contentTypes.DOCUMENT)
      frame.allowingDocumentFilter = filter;

    let allowingReason = getAllowingReason(typeMask, filter);
    logItem(details, filter, {...matchInfo, allowingReason});
  }
}

async function discoverExistingFrames() {
  let tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(({id: tabId}) =>
    browser.webNavigation.getAllFrames({tabId}).then(rawFrames => {
      if (!rawFrames || !startupPromise)
        return;

      rawFrames.sort((a, b) => a.frameId - b.frameId);

      let frames = new Map();
      state.set(tabId, frames);

      for (let {frameId, parentFrameId, url} of rawFrames) {
        frames.set(frameId, new FrameInfo(tabId, frameId,
                                          frames.get(parentFrameId), url));
      }
    })
  ));
}

function onHeadersReceived(details) {
  let {tabId, frameId, url, responseHeaders} = details;
  let sitekey = setSitekeyFromHeaders(
    tabId, frameId, url, responseHeaders
  );
  if (sitekey) {
    let frame = getFrameInfo(tabId, frameId);
    if (frame && frame.url == url && frame.sitekey != sitekey) {
      frame.sitekey = sitekey;
      findAllowlistingFilters(frame, tabId, frameId);
    }
  }
}

function recordFrameFromNavigationEvent({tabId, frameId, parentFrameId, url},
                                        historyStateUpdated) {
  let frames = state.get(tabId);
  let parent = frames && frames.get(parentFrameId);

  // Top-level history-state updates don't invalidate the existing frames.
  if ((!historyStateUpdated && frameId == 0) || !frames) {
    frames = new Map();
    state.set(tabId, frames);
  }

  frames.set(frameId, new FrameInfo(tabId, frameId, parent, url));
}

function onBeforeNavigate(details) {
  if (details.url == "about:srcdoc")
    recordFrameFromNavigationEvent(details, false);
}

function onCommitted(details) {
  recordFrameFromNavigationEvent(details, false);
}

function onHistoryStateUpdated(details) {
  recordFrameFromNavigationEvent(details, true);
}

function onRemoved(tabId) {
  state.delete(tabId);
  clearTabSitekeys(tabId);
}

function onReplaced(addedTabId, removedTabId) {
  state.delete(removedTabId);
  clearTabSitekeys(removedTabId);
}

export function getFrameInfo(tabId, frameId, initiator) {
  let frames = state.get(tabId);
  if (frames) {
    let frame = frames.get(frameId);
    if (frame)
      return frame;
  }

  if (initiator)
    return new FrameInfo(tabId, frameId, null, initiator);
}

export async function start() {
  if (!startupPromise) {
    startupPromise = discoverExistingFrames();

    browser.webRequest.onHeadersReceived.addListener(
      onHeadersReceived,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame", "sub_frame"]
      },
      ["responseHeaders"]
    );
    browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    browser.webNavigation.onCommitted.addListener(onCommitted);
    browser.webNavigation.onHistoryStateUpdated.addListener(
      onHistoryStateUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.tabs.onReplaced.addListener(onReplaced);
  }

  await startupPromise;
}

export function stop() {
  startupPromise = null;
  state.clear();
  clearAllSitekeys();

  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
  browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.webNavigation.onHistoryStateUpdated.removeListener(
    onHistoryStateUpdated);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onReplaced.removeListener(onReplaced);
}
