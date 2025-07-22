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
  initializeEvent,
  integrations,
  requestEvent,
  responseEvent,
} from "../shared/constants.js";
import apiHandlers from "./api-handlers/index.js";
import { getIntegrationName } from "../shared/helpers.js";
import { mainPublicApi } from "../content/main-public-api.js";

const { short_name, version } = browser.runtime.getManifest();
const name = getIntegrationName(short_name);

/**
 * @typedef {Object} StartParams
 * @property {any} port A reference to the port object
 * @property {Function} hasPremium Function to get the premium state of the user
 * @property {addTrustedMessageTypesFunction} addTrustedMessageTypes Function to add the trusted message types
 */

/**
 * A callback function that modifies the allowlist for a tab.
 *
 * @callback addTrustedMessageTypesFunction
 * @param {string} origin - The origin of the message.
 * @param {string[]} types - The message types to be trusted.
 */

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
 * Initializes the Public API fragment.
 *
 * @param {StartParams} StartParams The start parameters
 */
export function start({ port, hasPremium, addTrustedMessageTypes }) {
  // Initialize the main world API
  port.on(initializeEvent, async (message, sender) => {
    const tabId = (sender.tab || {}).id;
    const frameId = sender.frameId || 0;

    if (!tabId || !frameId) {
      return {
        name,
        version,
        error: "invalid_invocation",
      };
    }

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
  });

  port.on(requestEvent, async (message, sender) => {
    const tabId = (sender.tab || {}).id;

    if (!tabId) {
      return {
        name,
        version,
        error: "invalid_invocation",
      };
    }

    const { method, params } = message;
    const handler = apiHandlers[method];

    if (!handler) {
      console.warn("Unknown method received from Public API:", method);
      return {
        name,
        version,
        error: "invalid_method",
      };
    }

    const response = {};
    try {
      response.result = await handler.bind({ hasPremium, sender }, params)();
    } catch (e) {
      console.warn("An error occurred in the Public API for method", method, e);
      response.error = e.message;
    }

    return {
      name,
      version,
      ...response,
    };
  });

  const iframeUrl = new URL(apiFrameUrl);
  addTrustedMessageTypes(iframeUrl.origin, [requestEvent, initializeEvent]);
}
