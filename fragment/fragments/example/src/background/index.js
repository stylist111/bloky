/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import { imageCountEvent } from "../shared/constants.js";

/**
 * Updates the image count in local storage.
 *
 * @param {string} domain The domain for which to update the counter
 * @param {number} count By how much to increase the counter.
 * @returns {Promise<void>}
 */
async function updateImageCount(domain, count) {
  let domainCounter = await browser.storage.local.get(domain);

  if (Object.keys(domainCounter).length === 0) {
    domainCounter = { [domain]: 0 };
  }

  domainCounter[domain] += count;
  await browser.storage.local.set(domainCounter);
}

/**
 * Initializes the dummy fragment.
 */
export function start() {
  browser.runtime.onMessage.addListener((message, sender) => {
    const tabId = (sender.tab || {}).id;
    const { type, imageCount } = message;

    if (type !== imageCountEvent) {
      return false; // Ignore other messages
    }

    if (!tabId) {
      console.log("Illegal invocation not coming from a tab");
      return false;
    }

    const parsedUrl = new URL(sender.tab.url);
    return updateImageCount(parsedUrl.hostname, imageCount);
  });
}
