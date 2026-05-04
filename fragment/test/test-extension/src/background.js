/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import { start as exampleFragmentStart } from "@eyeo-fragments/example";
import { startEwe } from "./modules/ewe-init.js";
import { startYtWallFragment } from "./modules/yt-wall-init.js";
import apiHandlersFactory from "./api/index.js";

(async () => {
  // Start EWE
  startEwe();

  // Initialize Fragments
  exampleFragmentStart();
  const { port } = startYtWallFragment();

  // Initialize API handlers
  const apiHandlers = {
    ...apiHandlersFactory,
    testing: apiHandlersFactory.testing,
    ewe: apiHandlersFactory.ewe,
  };

  // Set up message listener
  browser.runtime.onMessage.addListener(async (message, sender) => {
    // Route type-based messages to port registry
    if (message.type && port.__registry[message.type]) {
      return await port.__registry[message.type](message, sender);
    }

    const { method, args = [] } = message;
    const parts = method.split(".");
    let handler = apiHandlers;

    for (const part of parts) {
      handler = handler?.[part];
      if (!handler) {
        break;
      }
    }

    if (typeof handler === "function") {
      try {
        if (
          handler === apiHandlers.testing.triggerHandler ||
          handler === apiHandlers.testing.getRegisteredHandlers
        ) {
          return await handler.bind(null, port)(args, sender);
        }
        return await handler(args, sender);
      } catch (error) {
        return { error: `Handler execution failed: ${error.message}` };
      }
    }

    return { error: `Unknown method: ${method}` };
  });
})();
