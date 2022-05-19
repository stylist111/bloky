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

export function setSitekeyFromHeaders(tabId, frameId, url, headers) {
  let sitekeyHeader = getSitekeyHeader(headers);
  if (!sitekeyHeader)
    return null;

  // If this sitekey is the same as the one we already have, we can
  // just leave the existing one. No need to do signature verification
  // since we've already checked this sitekey on this site.
  let existingSitekey = getSitekey(tabId, frameId, url);
  if (sitekeyHeader.sitekey == existingSitekey)
    return existingSitekey;

  let {sitekey, signature} = sitekeyHeader;
  if (verifySitekey(sitekey, signature, url)) {
    setSitekey(tabId, frameId, url, sitekey);
    return sitekey;
  }
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
