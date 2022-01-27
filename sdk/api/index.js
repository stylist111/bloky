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

import {synchronizer} from "adblockpluscore/lib/synchronizer.js";
import {notifications as _notifications}
  from "adblockpluscore/lib/notifications.js";

import {default as initializer} from "./initializer.js";
import * as messageResponder from "./message-responder.js";
import {configureDefaultSubscriptions} from "./default-subscriptions.js";
import {setSnippetLibrary} from "./content-filter.js";

export {default as subscriptions} from "./subscriptions.js";
export {default as filters} from "./filters.js";
export {default as reporting} from "./reporting.js";
export {default as debugging} from "./debugging.js";

/**
 * The notifications API (optional usage).
 *
 * To start using this module, calling `notifications.start()` is required.
 * Please also notice that notification events are **not** using the
 * {@link #eventdispatcher|EventDispatcher} interface.
 * @see {@link https://eyeo.gitlab.io/adblockplus/abc/adblockpluscore/next/docs/module-notifications-Notifications.html|Adblock Plus core notifications documentation}
 * @external
 */
// Workaround for documentation.js to parse the JSDocs above
// https://github.com/documentationjs/documentation/issues/1363
export let notifications = _notifications;

export let snippets = {
  /**
   * Enables support for snippet filters.
   * @param {Object} [snippetInfo]
   * @param {string} [snippetInfo.isolatedCode]
   *   The code defining the available snippets to be executed in the isolated
   *   content script context.
   * @param {string} [snippetInfo.injectedCode]
   *   The code defining the available snippets to be injected and executed in
   *   the main context.
   * @param {Array.<string>} [snippetInfo.injectedList]
   *   An array containing the injectable snippets.
   */
  setLibrary: setSnippetLibrary
};

let stopped = true;

async function startAsyncModule(startModule) {
  await startModule();
  if (stopped)
    throw new Error("Stopped before initialization was finished");
}

/**
* @typedef {Object} FirstRunInfo
* @property {boolean} foundStorage Whether the subscriptions storage was
*                                  initialized or not.
* @property {boolean} foundSubscriptions True when pre-existing subscriptions
*                                        were found, false otherwise.
*                                        Considers also whether custom filters
*                                        exist.
*/

/**
 * Initializes the filter engine and starts blocking content.
 *
 * Calling this function is required for the other API calls to work, except for
 * API event listener calls, which could also be done before `start()`.
 * @return {Promise.<FirstRunInfo>} Promise that is resolved after
 *                                  starting up is completed. Promise
 *                                  is rejected if `stop()` is called
 *                                  before starting is completed.
 * @see {@link #stop|stop()}
 */
export async function start() {
  stopped = false;
  messageResponder.start();
  await startAsyncModule(() => initializer.start());
  synchronizer.start();
  let firstRun = configureDefaultSubscriptions();
  return firstRun;
}

/**
 * Stops blocking any content.
 */
export function stop() {
  stopped = true;
  messageResponder.stop();
  initializer.stop();
  synchronizer.stop();
  notifications.stop();
}
