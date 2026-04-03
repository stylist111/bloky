/**
 * This file is part of eyeo's close-tab fragment,
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
import { closeTabEvent } from "../shared/constants.js";

/**
 * @typedef {Object} StartParams
 * @property {any} port A reference to the port object
 * @property {addTrustedMessageTypesFunction} addTrustedMessageTypes Function to add the trusted message types
 * @property {string[]} trustedOrigins List of origins allowed to send close-tab messages
 */

/**
 * A callback function that registers trusted message types for an origin.
 *
 * @callback addTrustedMessageTypesFunction
 * @param {string} origin - The origin of the message.
 * @param {string[]} types - The message types to be trusted.
 */

/**
 * Initializes the close-tab fragment.
 *
 * Registers a message handler for "app.close" that closes the sender's tab,
 * and restricts the message type to the provided trusted origins.
 *
 * @param {StartParams} params The start parameters
 */
export function start({ port, addTrustedMessageTypes, trustedOrigins }) {
  /**
   * Closes the tab that sent the message.
   *
   * @event "app.close"
   */
  port.on(closeTabEvent, (message, sender) => {
    if (sender.tab && sender.tab.id) {
      void browser.tabs.remove(sender.tab.id);
    }
  });

  for (const origin of trustedOrigins) {
    addTrustedMessageTypes(origin, [closeTabEvent]);
  }
}
