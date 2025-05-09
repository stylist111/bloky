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
import { start as startMainWorldAPIInjection } from "./api-injector.js";
import { apiFrameUrl, requestEvent } from "../shared/constants.js";
import apiHandlers from "./api-handlers/index.js";
import { getIntegrationName } from "../shared/helpers.js";

const { short_name, version } = browser.runtime.getManifest();
const name = getIntegrationName(short_name);

/**
 * @typedef {Object} StartParams
 * @property {any} port A reference to the port object
 * @property {addTrustedMessageTypesFunction} addTrustedMessageTypes Function to add the trusted message types
 * @property {Function} isPremiumActive Function to get the premium state of the user
 * @property {Function} getEncodedLicense Function to get the encoded license of the user
 */

/**
 * A callback function that modifies the allowlist for a tab.
 *
 * @callback addTrustedMessageTypesFunction
 * @param {string} origin - The origin of the message.
 * @param {string[]} types - The message types to be trusted.
 */

/**
 * Initializes the Public API fragment.
 *
 * @param {StartParams} StartParams The start parameters
 */
export function start({
  port,
  addTrustedMessageTypes,
  isPremiumActive,
  getEncodedLicense,
}) {
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
      response.result = await handler.bind(
        { isPremiumActive, getEncodedLicense, sender },
        params,
      )();
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
  addTrustedMessageTypes(iframeUrl.origin, [requestEvent]);
  startMainWorldAPIInjection();
}
