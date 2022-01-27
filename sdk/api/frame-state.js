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
import {verifySignature} from "adblockpluscore/lib/rsa.js";
import {logItem} from "./diagnostics.js";

let state = new Map();
let startupPromise;

class FrameInfo {
  constructor(tabId, frameId, parent, url, pending) {
    if (pending && pending.url != url)
      pending = null;

    if (!pending && (url.startsWith("http://") ||
                     url.startsWith("https://")))
      pending = new PendingFrameInfo(tabId, frameId, parent, url);

    let {hostname, sitekey, allowlisted} = pending || parent || {};

    this.url = url;
    this.hostname = hostname;
    this.sitekey = sitekey;
    this.allowlisted = allowlisted || 0;
    this.parent = parent;
    this.pending = null;
  }
}

function getAllowingReason(typeMask, filter) {
  for (let type in contentTypes) {
    if (typeMask & filter.contentType & contentTypes[type])
      return type.toLowerCase();
  }
}

function findAllowlistingFilters(frame) {
  let details = {tabId: frame.tabId, frameId: frame.frameId, url: frame.url};
  // The docDomain for a frame is the hostname of the parent frame
  // (the loader). For top-level frames we use the current URL's hostname.
  let matchInfo = {docDomain: frame.parentHostname || frame.hostname,
                   method: "allowing"};

  while (true) {
    let typeMask = ~frame.allowlisted & ALLOWING_TYPES;
    let filter = matcher.match(
      frame.url, typeMask, frame.parentHostname, frame.sitekey
    );

    if (!filter)
      break;

    frame.allowlisted |= filter.contentType & ALLOWING_TYPES;

    let allowingReason = getAllowingReason(typeMask, filter);
    logItem(details, filter, {...matchInfo, allowingReason});
  }
}

class PendingFrameInfo {
  constructor(tabId, frameId, parent, url, sitekey) {
    let allowlisted = 0;
    let parentHostname;

    if (parent) {
      ({hostname: parentHostname, allowlisted} = parent);

      if (!sitekey)
        ({sitekey} = parent);
    }

    let urlInfo = parseURL(url);

    this.tabId = tabId;
    this.frameId = frameId;
    this.url = url;
    this.hostname = urlInfo.hostname;
    this.parentHostname = parentHostname;
    this.sitekey = sitekey;
    this.allowlisted = allowlisted;

    findAllowlistingFilters(this);
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
  let frames = state.get(details.tabId);
  if (!frames) {
    frames = new Map();
    state.set(details.tabId, frames);
  }

  let frame = frames.get(details.frameId);
  let parent = frames.get(details.parentFrameId);
  let sitekey = getSitekeyFromHeaders(details.responseHeaders, details.url);

  if (frame) {
    let allowlistFrame = frame.pending || frame;
    allowlistFrame.sitekey = sitekey || allowlistFrame.sitekey;
    findAllowlistingFilters(allowlistFrame);
  }
  else {
    frame = new FrameInfo(details.tabId, details.frameId, parent,
                          "about:blank");
    frames.set(details.frameId, frame);
    frame.pending = new PendingFrameInfo(details.tabId, details.frameId, parent,
                                         details.url, sitekey);
  }
}

function recordFrameFromNavigationEvent({tabId, frameId, parentFrameId, url},
                                        historyStateUpdated) {
  let frames = state.get(tabId);
  let pending;
  let parent;

  if (frames) {
    let frame = frames.get(frameId);
    pending = frame && frame.pending;
    parent = frames.get(parentFrameId);
  }

  // Top-level history-state updates don't invalidate the existing frames.
  if ((!historyStateUpdated && frameId == 0) || !frames) {
    frames = new Map();
    state.set(tabId, frames);
  }

  frames.set(frameId, new FrameInfo(tabId, frameId, parent, url, pending));
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
}

function onReplaced(addedTabId, removedTabId) {
  state.delete(removedTabId);
}

function verifyAndExtractSitekey(token, url) {
  let parts = token.split("_");
  if (parts.length < 2)
    return null;

  let key = parts[0].replace(/=/g, "");
  let signature = parts[1];
  let urlObj = new URL(url);
  let data = `${urlObj.pathname}${urlObj.search}\0${urlObj.host}\0` +
             self.navigator.userAgent;
  if (!verifySignature(key, signature, data))
    return null;

  return key;
}

function getSitekeyFromHeaders(headers, url) {
  for (let header of headers) {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value) {
      let sitekey = verifyAndExtractSitekey(header.value, url);
      if (sitekey)
        return sitekey;
    }
  }
  return null;
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

  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
  browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.webNavigation.onHistoryStateUpdated.removeListener(
    onHistoryStateUpdated);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onReplaced.removeListener(onReplaced);
}
