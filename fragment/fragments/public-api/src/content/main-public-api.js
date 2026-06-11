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

export function mainPublicApi({ requestEvent, responseEvent, integrations }) {
  // Queue of responses to wait for
  const responseQueue = {};

  /**
   * Generates a random 10 char identifier
   *
   * @returns {string} The identifier
   */
  function generateRequestId() {
    return Math.random().toString(36).substring(2, 12);
  }

  /**
   * Checks if two sets are equal
   *
   * @param {Set<any>} setA First Set
   * @param {Set<any>} setB Second set
   * @returns {boolean} True if they are equal, false otherwise
   */
  function areSetsEqual(setA, setB) {
    if (setA.size !== setB.size) {
      return false;
    }

    setA.forEach((elem) => {
      if (!setB.has(elem)) {
        return false;
      }
    });

    return true;
  }

  /**
   * Retrieves the extensions that are currently available or
   * throws an error in case no extension is available
   *
   * @returns {Set<string>} A Set of available extensions
   */
  function getAvailableExtensions() {
    const dataset = document.documentElement.dataset;
    const availableExts = new Set();

    integrations.forEach((integration) => {
      if (dataset[integration]) {
        availableExts.add(integration);
      }
    });

    if (availableExts.size === 0) {
      throw new Error("There is no extension available");
    }

    return availableExts;
  }

  /**
   * Handles the events received from the content scripts
   *
   * @param event The event received from the content script
   */
  function responseHandler(event) {
    const { detail } = event;
    const { requestId, name } = detail;

    // Ignore responses that don't have a proper identifier attached to them (see EXT-872)
    if (!requestId || !name) {
      console.error("Invalid response received from the extension", detail);
      return;
    }

    const queuedResponse = responseQueue[requestId];

    if (!queuedResponse) {
      return; // Ignore responses that are not queued anymore
    }

    const { availableExts, resolve, collectedResponses, responded, timeoutId } =
      queuedResponse;
    collectedResponses.push(detail);
    responded.add(name);

    // If all extensions replied, then remove the item from queue
    // and resolve the promise
    if (areSetsEqual(availableExts, responded)) {
      resolve(collectedResponses);
      delete responseQueue[requestId];
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sends a command to the available extensions on the page.
   *
   * @param {string} method The method to be called.
   * @param {String} [targetExt] The extension to target
   * @param {Object} [params] The parameters for the called method
   * @param {number} [timeoutMs=3000] How long to wait for a response
   * @returns {Promise<Array<object>>} An array of responses
   */
  async function sendExtCommand({
    method,
    targetExt,
    params,
    timeoutMs = 3000,
  }) {
    const requestId = generateRequestId();
    const availableExts = getAvailableExtensions();

    // Validate if the extension is available,
    // if only a specific extension was targeted
    if (targetExt && !availableExts.has(targetExt)) {
      throw new Error("Target extension is not initialized");
    }

    return new Promise((resolve, reject) => {
      const collectedResponses = [];
      const responded = new Set();

      // Set a timeout to reject the promise after timeoutMs
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);

        // Add timeout responses for the extensions that did not respond
        availableExts.forEach((ext) => {
          if (!responded.has(ext)) {
            collectedResponses.push({
              name: ext,
              requestId,
              error: "timeout_error",
            });
          }
        });

        resolve(collectedResponses);
      }, timeoutMs);

      // Register an expected response into the queue
      responseQueue[requestId] = {
        availableExts, // Available extensions at call time
        collectedResponses, // Responses collected from the extensions
        responded, // Extensions that responded
        resolve,
        timeoutId,
      };

      // Send command to content script
      document.dispatchEvent(
        new CustomEvent(requestEvent, {
          detail: {
            params,
            method,
            requestId,
            targetExt,
          },
        }),
      );
    });
  }

  function init() {
    // Define the publicAPI on the window object
    // If multiple extensions are available only the first one will define the API
    // eslint-disable-next-line no-prototype-builtins
    if (!window.hasOwnProperty("sendExtCommand")) {
      Object.defineProperty(window, "sendExtCommand", {
        value: sendExtCommand,
        writable: false, // Prevent modification of the value
        configurable: false, // Prevent the property from being deleted or redefined
        enumerable: true, // Allow the property to be enumerated (optional)
      });

      document.addEventListener(responseEvent, responseHandler, true);
    }
  }

  init();
}
