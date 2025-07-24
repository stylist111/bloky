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

/* eslint-disable no-console */

import browser from "webextension-polyfill";
import {v4 as uuidv4} from "uuid";
import {log} from "./safari-logs.js";

export async function patchSender(details) {
  log("patchSender()");
  let tabId = details.tabId;
  let frameId = details.frameIds[0];

  // generate function names
  const pushStateFn = uuidv4();
  const replaceStateFn = uuidv4();

  try {
    await browser.scripting.executeScript({
      target: details,
      world: "MAIN",
      injectImmediately: true,
      args: [tabId, frameId, pushStateFn, replaceStateFn],
      // eslint-disable-next-line no-shadow
      func(tabId, frameId, pushStateFn, replaceStateFn) {
        if (history[pushStateFn]) {
          console.warn("Already injected");
          return;
        }

        function sendOnHistoryUpdatedMessage(state, url) {
          let event = {
            state, timeStamp: Date.now(),
            url: new URL(url, document.baseURI).href // convert to absolute URL
          };
          window.postMessage({
            type: "ewe:safari-onhistorystateupdated-content",
            event
          });
        }

        // Randomize function names and save for later use
        history[pushStateFn] = history.pushState;
        history[replaceStateFn] = history.replaceState;

        console.warn("Injected forwarding history API()");
        history.pushState = function(state, unused, url) {
          history[pushStateFn](state, unused, url);
          sendOnHistoryUpdatedMessage(state, url);
        };
        history.replaceState = function(state, unused, url) {
          history[replaceStateFn](state, unused, url);
          sendOnHistoryUpdatedMessage(state, url);
        };
      }
    });
  }
  catch (e) {
    console.error("Failed to inject History API", e);
  }
}
