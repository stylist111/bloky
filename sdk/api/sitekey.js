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

let sitekeys = new Map();

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
  let sitekeysForTab = sitekeys.get(tabId);
  if (!sitekeysForTab)
    return null;
  let sitekeysForFrame = sitekeysForTab.get(frameId);
  if (!sitekeysForFrame)
    return null;
  return sitekeysForFrame.get(url);
}

function setSitekey(tabId, frameId, url, sitekey) {
  let sitekeysForTab = sitekeys.get(tabId);
  if (!sitekeysForTab) {
    sitekeysForTab = new Map();
    sitekeys.set(tabId, sitekeysForTab);
  }

  let sitekeysForFrame = sitekeysForTab.get(frameId);
  if (!sitekeysForFrame) {
    sitekeysForFrame = new Map();
    sitekeysForTab.set(frameId, sitekeysForFrame);
  }

  sitekeysForFrame.set(url, sitekey);
}

export function clearAllSitekeys() {
  sitekeys.clear();
}

export function clearTabSitekeys(tabId) {
  sitekeys.delete(tabId);
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
  let existingSitekey = getSitekey(tabId, frameId, url);
  if (existingSitekey && newSitekey == existingSitekey)
    return existingSitekey;

  if (newSitekey && verifySitekey(newSitekey, sitekeyHeader.signature, url)) {
    setSitekey(tabId, frameId, url, newSitekey);
    return newSitekey;
  }

  // Inserting null here indicates that we've received headers for a
  // URL and it didn't have sitekeys (as opposed to not receiving
  // filters yet).
  setSitekey(tabId, frameId, url, null);
  return null;
}

function getSitekeyHeader(headers) {
  for (let header of headers) {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value) {
      let parts = header.value.split("_");
      if (parts.length < 2)
        return null;

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
    self.navigator.userAgent
  ].join("\0");
  return verifySignatureSync(sitekey, signature, data);
}
