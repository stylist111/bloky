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

import {default as initializer} from "./initializer.js";
import * as messageResponder from "./message-responder.js";
import * as popupBlockerBackgroundPage from "./popup-blocker-background-page.js";
import * as popupBlockerServiceWorker from "./popup-blocker-service-worker.js";
import * as requestFilter from "./request-filter.js";
import * as dnrRequestReporter from "./dnr-request-reporter.js";
import * as sitekey from "./sitekey.js";
import * as telemetry from "./telemetry.js";
import {setSnippetLibrary} from "./content-filter.js";
import {setAddonInfo} from "./info.js";
import {filterEngine} from "./core.js";
import {updateFilterText, validate as validateSubscriptions,
        migrate as migrateSubscriptions, ensureDNRRulesetsEnabled}
  from "./subscriptions.js";
import {migrateCustomFilters} from "./dnr-filters.js";
import {MIGRATED_TO_MV2, MIGRATED_TO_MV3, Prefs} from "./prefs.js";
import {isRunningInServiceWorker} from "./browser-features.js";

export {default as subscriptions} from "./subscriptions.js";
export {default as filters} from "./filters.js";
export {default as reporting} from "./reporting.js";
export {default as debugging} from "./debugging.js";
export {default as allowlisting} from "./allowlisting.js";
export {default as testing} from "./testing.js";
export {notifications} from "./notifications.js";

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

const SESSION_STORAGE_KEY = "ewe:skip_init_rulesets";

async function onInstalled(details) {
  // Web extension update (with potential subscriptions filter
  // text changed and repacked) can happen in the same browser session.
  // So in order to not skip the next subscriptions filter text update
  // the flag is removed.
  if (details.reason != browser.runtime.OnInstalledReason.UPDATE) {
    return;
  }

  await browser.storage.session.remove(SESSION_STORAGE_KEY);
}

/**
* @typedef {Object} FirstRunInfo
* @property {boolean} foundStorage Whether the subscriptions storage was
*                                  initialized or not.
* @property {boolean} foundSubscriptions True when pre-existing subscriptions
*                                        were found, false otherwise.
*                                        Considers also whether custom filters
*                                        exist.
* @property {Array.<string>?} [warnings] An array of warnings.
*/

/**
 * Initializes the filter engine and starts blocking content.
 *
 * Calling this function is required for the other API calls to work, except for
 * API event listener calls, which could also be done before `start()`.
 *
 * In MV3 extensions, this must be called in the first turn of the
 * event loop.
 *
 * @param {Object?} [addonInfo] An object containing addon
 *   information belonging to sdk consumer, that can be accessed via
 *   `debugging` module. (It is usually used as an identifier in
 *   network requests, etc.). This object can be undefined for MV2. If it is,
 *   name and version will default to the extension's name and version.
 * @param {string} [addonInfo.name] Name of the addon/extension.
 * @param {string} [addonInfo.version] Version of the addon/extension.
 * @param {Array<Recommendation>?} [addonInfo.bundledSubscriptions]
 *   A list of subscriptions provided by the integrator. Cannot be undefined
 *   for MV3.
 * @param {string?} [addonInfo.bundledSubscriptionsPath]
 *   A path to subscription files provided by the integrator. Cannot be
 *   undefined for MV3.
 * @param {Object?} [addonInfo.telemetry] Settings for telemetry. The telemetry
 *   module will only be started if this is provided. This is currently an
 *   experimental feature. If used, this will send a single POST request on
 *   first start to the specified telemetry URL, using the specified bearer
 *   token for authentication, with metadata about the extension.
 * @param {string} [addonInfo.telemetry.url] The URL of the location where
 *   user active pings will be sent to.
 * @param {string} [addonInfo.telemetry.bearer] The Bearer token accompanying
 *   the telemetry URL.
 * @return {Promise<FirstRunInfo>} Promise that is resolved after starting up
 *                                 is completed.
 */
export async function start(addonInfo) {
  setAddonInfo(addonInfo);
  startSubmodulesWithListeners();

  let warnings = [];

  if (browser.declarativeNetRequest) {
    browser.runtime.onInstalled.addListener(onInstalled);
    warnings = await validateSubscriptions(
      addonInfo.bundledSubscriptions, addonInfo.bundledSubscriptionsPath);
  }

  await startSubmodules();

  let {filterStorage} = filterEngine;
  let firstRun = {
    foundSubscriptions: filterStorage.getSubscriptionCount() != 0,
    foundStorage: !filterStorage.firstRun,
    warnings
  };

  if (browser.declarativeNetRequest) {
    await checkAndMigrateSubscriptions();
    await checkAndInitSubscriptions();
  }

  if (addonInfo && addonInfo.telemetry) {
    telemetry.start(addonInfo.telemetry);
  }

  return firstRun;
}

function startSubmodulesWithListeners() {
  // for MV3, submodules that register event listeners generally need
  // to register their events in the first turn of the event loop to
  // register their event listeners.
  messageResponder.start();
  if (isRunningInServiceWorker()) {
    popupBlockerServiceWorker.start();
  }

  if (browser.declarativeNetRequest) {
    dnrRequestReporter.start();
  }

  sitekey.start();
}

async function startSubmodules() {
  await initializer.start();

  // MV2-style popup and request blocking assume that initializer is
  // started first.
  if (!isRunningInServiceWorker()) {
    popupBlockerBackgroundPage.start();
  }

  if (!browser.declarativeNetRequest) {
    requestFilter.start();
  }

  filterEngine.filterStorage.synchronizer.start();
}

async function checkAndMigrateSubscriptions() {
  if (Prefs.migration_state !== MIGRATED_TO_MV3) {
    await migrateSubscriptions();

    if (Prefs.migration_state === MIGRATED_TO_MV2) {
      await migrateCustomFilters();
    }

    Prefs.migration_state = MIGRATED_TO_MV3;
  }
}

async function checkAndInitSubscriptions() {
  // Loading the subbcriptions filter text can cause start-up
  // performance penalty, so we do it only once per session only.
  let skipInit = await browser.storage.session.get(
    [SESSION_STORAGE_KEY]
  );
  if (skipInit[SESSION_STORAGE_KEY]) {
    return;
  }

  await updateFilterText();
  await ensureDNRRulesetsEnabled();

  await browser.storage.session.set(
    {[SESSION_STORAGE_KEY]: true}
  );
}
