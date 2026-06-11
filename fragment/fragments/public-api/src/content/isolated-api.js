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
import {
  requestEvent,
  responseEvent,
  initializeEvent,
} from "../shared/constants.js";
import { getIntegrationName } from "../shared/helpers.js";

const { short_name } = browser.runtime.getManifest();
const extName = getIntegrationName(short_name);

/**
 * Sends a response to the main world by dispatching an event to the DOM.
 *
 * @param response The response to be sent.
 */
function sendResponseToMainWorld(response) {
  let options = { detail: response };
  if (typeof cloneInto === "function") {
    // Firefox requires content scripts to clone objects
    // that are passed to the document
    options = cloneInto(options, document.defaultView);
  }

  document.dispatchEvent(new CustomEvent(responseEvent, options));
}

/**
 * Handles a command received from the main world
 *
 * @param {string} requestId The request id
 * @param {string} method The method to call on the background script
 * @param {Object} params THe parameters for the command
 * @returns {Promise<void>}
 */
async function handleCommand({ requestId, method, params }) {
  const response = await browser.runtime.sendMessage({
    type: requestEvent,
    method,
    params,
  });

  // The SW should never reply with an empty response
  // This can happen if the URL was not properly added to the trusted types (see EXT-872)
  if (!response) {
    sendResponseToMainWorld({
      requestId,
      extName,
      error: "unexpected_error",
    });

    return;
  }

  sendResponseToMainWorld({
    requestId,
    ...response,
  });
}

/**
 * Signals to the Main world script that the content script was initialized
 * by adding a hidden div into the page.
 *
 * Signals to the SW that the main world API should be initialized.
 */
async function sendReadySignal() {
  const html = document.documentElement;
  html.dataset[extName] = "true";

  // Signal SW to initialize the main world API
  await browser.runtime.sendMessage({ type: initializeEvent });
}

/**
 * Starts the initialization of the Isolated world API
 */
function start() {
  document.addEventListener(
    requestEvent,
    async (ev) => {
      const { detail } = ev;
      const { params, method, requestId, targetExt } = detail;

      if (targetExt && targetExt !== extName) {
        return;
      }

      await handleCommand({
        requestId,
        method,
        params,
      });
    },
    true,
  );

  void sendReadySignal();
}

start();
