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

import {verifySignatureSync} from "adblockpluscore/lib/rsa.js";
import browser from "./browser.js";
import {isRunningInServiceWorker} from "./browser-features.js";
import {trace} from "./debugging.js";
import {PersistentState} from "./persistence.js";

const TOP_LEVEL_FRAME_ID = 0;

/**
 * All known sitekeys, that can be looked up by
 * `tabId`, and then by `frameId`, and then by `url`
 *  (`[tabId, [frameId, [url, {sitekey, signature}]]]]`).
 *
 * @type {Object}
 */
let sitekeys = new PersistentState("ewe:sitekeys", browser.storage.local);
let startupPromise;
let listeners = [];

// for testing purposes
export function _getSitekeys() {
  return sitekeys;
}

function notifySitekey(tabId, frameId, url, sitekey) {
  for (let listener of listeners) {
    listener(tabId, frameId, url, sitekey);
  }
}

function notifyAllSitekeys() {
  for (let [tabId, framesMap] of Object.entries(sitekeys.getState())) {
    for (let [frameId, sitekeysMap] of Object.entries(framesMap)) {
      for (let [url, sitekeyInfo] of Object.entries(sitekeysMap)) {
        notifySitekey(tabId, frameId, url, sitekeyInfo.sitekey);
      }
    }
  }
}

function onHeadersReceived({tabId, frameId, url, responseHeaders, frameType}) {
  trace({tabId, frameId, url, responseHeaders, frameType});

  if (frameId == TOP_LEVEL_FRAME_ID &&
     (frameType == null || frameType == "outermost_frame")) {
    // "frameType" is supported starting Chromium 106+.
    // If it's a new navigation and top level frame headers received,
    // we don't need sitekeys for all the previous frames of the tab.
    clearTabSitekeys(tabId);
  }

  let sitekey = setSitekeyFromHeaders(tabId, frameId, url, responseHeaders);
  if (sitekey) {
    notifySitekey(tabId, frameId, url, sitekey);
  }
}

export function addListener(listener) {
  listeners.push(listener);
}

/**
 * Gets the stored sitekey for a given frame. Sitekeys are retrieved
 * from the headers of main_frame and sub_frame requests (the html
 * documents in tabs and iframes).
 * @param {number} tabId Id of the tab the frame is on.
 * @param {number} frameId Id of the frame on the tab.
 * @param {string} url Url for the frame.
 * @return {string|null|undefined} The sitekey if we have it, null if
 *   we've processed headers for this frame but it didn't have a
 *   sitekey, undefined if we haven't seen any headers for this frame.
 */
export function getSitekey(tabId, frameId, url) {
  let sitekeysForTab = sitekeys.getState()[tabId];
  if (!sitekeysForTab) {
    return null;
  }
  let sitekeysForFrame = sitekeysForTab[frameId];
  if (!sitekeysForFrame) {
    return null;
  }
  let sitekeyInfo = sitekeysForFrame[url];
  return sitekeyInfo ? sitekeyInfo.sitekey : null;
}

export function _getSitekeySignature(tabId, frameId, url) {
  return sitekeys.getState()[tabId][frameId][url].signature;
}

export function _setSitekey(tabId, frameId, url, sitekey, signature) {
  let sitekeysForTab = sitekeys.getState()[tabId];
  if (!sitekeysForTab) {
    sitekeysForTab = {};
    sitekeys.getState()[tabId] = sitekeysForTab;
  }

  let sitekeysForFrame = sitekeysForTab[frameId];
  if (!sitekeysForFrame) {
    sitekeysForFrame = {};
    sitekeysForTab[frameId] = sitekeysForFrame;
  }

  sitekeysForFrame[url] = {sitekey, signature};
}

export function clearAllSitekeys(save = true) {
  sitekeys.clearState();
  if (save) {
    _saveSitekeys();
  }
}

export function clearTabSitekeys(tabId) {
  delete sitekeys.getState()[tabId];
  _saveSitekeys();
}

/**
 * Use the headers from an onHeadersReceived event for an main_frame
 * and sub_frame request to update our sitekey map. This also
 * validates the sitekey before storing.
 *
 * If there is no sitekey, this inserts a null entry in the sitekey
 * map so you can differentiate between not having a sitekey because
 * there wasn't one in the headers and because the headers haven't
 * been received yet.
 * @param {number} tabId Id of the tab the frame is on.
 * @param {number} frameId Id of the frame on the tab.
 * @param {string} url Url for the frame.
 * @param {webRequest.HttpHeaders} headers the HTTP response headers
 *   to check for a sitekey. See {@link webRequest API
 *   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/HttpHeaders}.
 * @return {string|null} The sitekey if it was found and is
 *   valid. Null if there was no valid sitekey.
 */
export function setSitekeyFromHeaders(tabId, frameId, url, headers) {
  let sitekeyHeader = getSitekeyHeader(headers);
  let newSitekey = sitekeyHeader ? sitekeyHeader.sitekey : null;

  // If this sitekey is the same as the one we already have, we can
  // just leave the existing one. No need to do signature verification
  // since we've already checked this sitekey on this site.
  let existingSitekeyInfo = getSitekey(tabId, frameId, url);
  if (existingSitekeyInfo &&
      existingSitekeyInfo.sitekey &&
      newSitekey == existingSitekeyInfo.sitekey) {
    return existingSitekeyInfo.sitekey;
  }

  if (newSitekey && verifySitekey(newSitekey, sitekeyHeader.signature, url)) {
    _setSitekey(tabId, frameId, url, newSitekey, sitekeyHeader.signature);
    _saveSitekeys();
    return newSitekey;
  }

  // Inserting null here indicates that we've received headers for a
  // URL and it didn't have sitekeys (as opposed to not receiving
  // filters yet).
  _setSitekey(tabId, frameId, url, null, null);
  _saveSitekeys();
  return null;
}

function getSitekeyHeader(headers) {
  for (let header of headers) {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value) {
      let parts = header.value.split("_");
      if (parts.length < 2) {
        return null;
      }

      return {
        sitekey: parts[0].replace(/=/g, ""),
        signature: parts[1]
      };
    }
  }
  return null;
}

function verifySitekey(sitekey, signature, url) {
  let urlObj = new URL(url);
  let data = [
    urlObj.pathname + urlObj.search,
    urlObj.host,
    navigator.userAgent
  ].join("\0");
  return verifySignatureSync(sitekey, signature, data);
}

function verifySitekeys(_sitekeys) {
  for (let [tabId, framesMap] of Object.entries(_sitekeys)) {
    for (let [frameId, sitekeysMap] of Object.entries(framesMap)) {
      for (let [url, sitekeyInfo] of Object.entries(sitekeysMap)) {
        try {
          let verified = sitekeyInfo.sitekey === null ||
              verifySitekey(sitekeyInfo.sitekey, sitekeyInfo.signature, url);

          if (!verified) {
            delete sitekeysMap[url];
          }
        }
        catch (e) {
          delete sitekeysMap[url];
        }
      }
      if (Object.keys(sitekeysMap).length == 0) {
        delete framesMap[frameId];
      }
    }
    if (Object.keys(framesMap).length == 0) {
      delete _sitekeys[tabId];
    }
  }
}

export async function _loadSitekeys(verify = true) {
  await sitekeys.load(verify ? verifySitekeys : null);
  notifyAllSitekeys();
}

export function _doSaveSitekeys() {
  sitekeys.save();
}

export function _saveSitekeys() {
  if (!isRunningInServiceWorker()) {
    return;
  }

  _doSaveSitekeys();
}

export async function _awaitSavingComplete() {
  await sitekeys.awaitSavingComplete();
}

export async function start() {
  if (!startupPromise) {
    browser.webRequest.onHeadersReceived.addListener(
      onHeadersReceived,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame", "sub_frame"]
      },
      ["responseHeaders"]
    );

    startupPromise = (isRunningInServiceWorker() ?
      _loadSitekeys() : Promise.resolve(null));
  }

  await startupPromise;
}
