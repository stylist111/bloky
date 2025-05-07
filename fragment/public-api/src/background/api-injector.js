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
import { prepareInlineScriptForInjection } from "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/snippets.js";
import {
  apiFrameUrl,
  integrations,
  requestEvent,
  responseEvent,
} from "../shared/constants.js";
import { mainPublicApi } from "../content/main-public-api.js";

/**
 * Injects a script into the main world context of a frame
 *
 * @param {object} details - The details for the
 * @param {number} details.tabId - The id of the tab
 * @param {number} details.frameId - The id of the frame
 * @param {Function} details.func - The function to be inserted into main world
 * @param {any[]} details.args - The parameters for the function.
 */
async function injectScriptInFrame({ tabId, frameId, func, args }) {
  if (browser.scripting && browser.scripting.executeScript) {
    if (Object.values(browser.scripting.ExecutionWorld).includes("MAIN")) {
      return browser.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: "MAIN",
        injectImmediately: true,
        func,
        args,
      });
    }
  }

  const executable = prepareInlineScriptForInjection(func, ...args);

  return browser.tabs.executeScript(tabId, {
    frameId,
    code: executable,
    matchAboutBlank: true,
    runAt: "document_start",
  });
}

/**
 * Starts the injection of the API into the main world context
 */
export function start() {
  browser.webNavigation.onCommitted.addListener(
    async (details) => {
      const { tabId, frameId } = details;
      // Only inject in iframes
      if (details.frameId !== 0) {
        try {
          await injectScriptInFrame({
            tabId,
            frameId,
            func: mainPublicApi,
            args: [
              {
                requestEvent,
                responseEvent,
                integrations,
              },
            ],
          });
        } catch (err) {
          console.debug("Error injecting Public API script", err);
        }
      }
    },
    { url: [{ urlMatches: apiFrameUrl }] },
  );
}
