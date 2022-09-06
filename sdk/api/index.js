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

import browser from "webextension-polyfill";
import {notifications as _notifications}
  from "adblockpluscore/lib/notifications.js";

import {default as initializer} from "./initializer.js";
import * as messageResponder from "./message-responder.js";
import {setSnippetLibrary} from "./content-filter.js";
import {setAddonInfo} from "./info.js";
import {filterEngine} from "./core.js";
import {setRecommendations} from "adblockpluscore/lib/recommendations.js";
import {validate} from "./subscriptions.js";

export {default as subscriptions} from "./subscriptions.js";
export {default as filters} from "./filters.js";
export {default as reporting} from "./reporting.js";
export {default as debugging} from "./debugging.js";
export {default as allowlisting} from "./allowlisting.js";

/**
 * The notifications API (optional usage).
 *
 * To start using this module, calling `notifications.start()` is required.
 * Please also notice that notification events are **not** using the
 * {@link #eventdispatcher|EventDispatcher} interface.
 * @see {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-notifications-Notifications.html?job=docs|Adblock Plus core notifications documentation}
 * @external
 */
// Workaround for documentation.js to parse the JSDocs above
// https://github.com/documentationjs/documentation/issues/1363
export let notifications = _notifications;

export let snippets = {
  /**
   * Snippet callback.
   * @callback SnippetCallback
   * @param {Object} environment
   *   The environment variables
   * @param {...Array.<Array.<string>>} _
   *   The snippets names and arguments.
   */

  /**
   * Enables support for snippet filters.
   * @param {Object} [snippetInfo]
   * @param {SnippetCallback} [snippetInfo.isolatedCode]
   *   The code defining the available snippets to be executed in the isolated
   *   content script context.
   * @param {SnippetCallback} [snippetInfo.injectedCode]
   *   The code defining the available snippets to be injected and executed in
   *   the main context.
   */
  setLibrary: setSnippetLibrary
};

/**
* @typedef {Object} FirstRunInfo
* @property {boolean} foundStorage Whether the subscriptions storage was
*                                  initialized or not.
* @property {boolean} foundSubscriptions True when pre-existing subscriptions
*                                        were found, false otherwise.
*                                        Considers also whether custom filters
*                                        exist.
* @property {Array.<string>} [warnings] An array of warnings.
*/

/**
 * Initializes the filter engine and starts blocking content.
 *
 * Calling this function is required for the other API calls to work, except for
 * API event listener calls, which could also be done before `start()`.
 * @param {Object?} [addonInfo] An object containing addon
 *   information belonging to sdk consumer, that can be accessed via
 *   `debugging` module. (It is usually used as an identifier in
 *   network requests, etc.). This object can be undefined for MV2.
 * @param {string} [addonInfo.name] Name of the addon/extension.
 * @param {string} [addonInfo.version] Version of the addon/extension.
 * @param {Array<Recommendation>} [addonInfo.bundledSubscriptions]
 *   A list of subscriptions provided by the integrator.
 * @param {string} [addonInfo.bundledSubscriptionsPath]
 *   A path to subscription files provided by the integrator.
 * @return {Promise<FirstRunInfo>} Promise that is resolved after
 *                                 starting up is completed. Promise
 *                                 is rejected if `stop()` is called
 *                                 before starting is completed.
 * @return {Promise<FirstRunInfo>} Promise that is resolved after starting up
 *                                 is completed.
 */
export async function start(addonInfo) {
  messageResponder.start();

  let warnings = [];
  if (browser.declarativeNetRequest) {
    if (!addonInfo)
      throw new Error("No addonInfo provided to EWE.start");

    warnings = await validate(addonInfo.bundledSubscriptions,
                              addonInfo.bundledSubscriptionsPath);
  }

  if (addonInfo) {
    setAddonInfo(addonInfo);

    if (addonInfo.bundledSubscriptions &&
        addonInfo.bundledSubscriptions.length > 0)
      setRecommendations(addonInfo.bundledSubscriptions);
  }

  await initializer.start();

  let {filterStorage} = filterEngine;

  filterStorage.synchronizer.start();

  let foundSubscriptions = filterStorage.getSubscriptionCount() != 0;
  let firstRun = {foundSubscriptions, foundStorage: !filterStorage.firstRun};

  return {...firstRun, warnings};
}
