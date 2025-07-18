/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import browser from "webextension-polyfill";
import { type WebRequest } from "webextension-polyfill";

/**
 * Add the BT specific header and value to request headers before they are sent to the server.
 *
 * @param details The before send headers details object
 */
function onBeforeSendHeadersListener(
  details: WebRequest.OnBeforeSendHeadersDetailsType
): WebRequest.BlockingResponseOrPromise {
  if (!details?.requestHeaders) {
    return {};
  }
  const headers = [...details.requestHeaders];
  headers.push({
    name: "X-Acceptable-Ads",
    value: "1"
  });

  return { requestHeaders: headers };
}

/**
 * Adds the before header send listener.
 *
 */
function addRequestHeader(): void {
  browser.webRequest.onBeforeSendHeaders.addListener(
    onBeforeSendHeadersListener,
    { urls: ["*://btloader.com/tag?*"], types: ["script"] },
    ["blocking", "requestHeaders", "extraHeaders"]
  );
}

/**
 * Removes the before header send listener.
 *
 */
function removeRequestHeader(): void {
  browser.webRequest.onBeforeSendHeaders.removeListener(
    onBeforeSendHeadersListener
  );
}

/**
 * Checks if the user has subscribed to AA
 * If so, then add the header request listener to then
 * add the new request header
 *
 */
async function filterChangeListener(): Promise<void> {
  // Since this is only a proof of concept, only run this test
  // in MV2 extensions
  if (browser.runtime.getManifest().manifest_version === 3) {
    return;
  }
  if (await ewe.subscriptions.has(ewe.subscriptions.ACCEPTABLE_ADS_URL)) {
    addRequestHeader();
  } else {
    removeRequestHeader();
  }
}

/**
 * Initializes the module
 */
export async function start(): Promise<void> {
  await filterChangeListener();
  ewe.subscriptions.onAdded.addListener(filterChangeListener);
  ewe.subscriptions.onRemoved.addListener(filterChangeListener);
}
