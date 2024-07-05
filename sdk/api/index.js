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
import * as messageDeferrer from "./content-message-deferrer.js";
import * as popupBlockerBackgroundPage from "./popup-blocker-background-page.js";
import * as popupBlockerServiceWorker from "./popup-blocker-service-worker.js";
import * as requestFilter from "./request-filter.js";
import * as dnrRequestReporter from "./dnr-request-reporter.js";
import * as sitekey from "./sitekey.js";
import * as contentMessageDeferrer from "./content-message-deferrer.js";
import * as telemetry from "./telemetry.js";
import * as subscriptions from "./subscriptions.js";
import * as debugging from "./debugging.js";
import * as filters from "./filters.js";
import * as reporting from "./reporting.js";
import * as testing from "./testing.js";
import * as prefs from "./prefs.js";
import * as cdp from "./cdp.js";
import * as cdpMetricsUploader from "./cdp-metrics-uploader.js";
import {setSnippetLibrary} from "./content-filter.js";
import {setAddonInfo} from "./info.js";
import {filterEngine} from "./core.js";
import {validate as validateSubscriptions,
        migrate as migrateSubscriptions, ensureDNRRulesetsEnabled,
        updateSubscriptionInformation, recoverMigrationErrorSubscriptions}
  from "./subscriptions.js";
import {migrateCustomFilters, clearRulesetUpdates,
        removeSubscriptionsDynamicFilters, enableAllDisabledStaticRules}
  from "./dnr-filters.js";
import {MIGRATED_TO_MV2, MIGRATED_TO_MV3, Prefs} from "./prefs.js";
import {isRunningInServiceWorker} from "./browser-features.js";

async function preApiCall() {
  // Service worker can be shut down and we might need
  // to initialize it before the usage.
  await initializer.start();
}

async function postApiCall() {
  if (!browser.declarativeNetRequest) {
    return;
  }

  await prefs.awaitSavingComplete();
  await filterEngine.filterStorage.awaitSavingComplete();
  await sitekey._awaitSavingComplete();
  await contentMessageDeferrer._awaitSavingComplete();
  await cdp._awaitSavingComplete();
}

function isAsync(func) {
  return func.constructor && func.constructor.name === "AsyncFunction";
}

function wrapApiNamespace(target) {
  return new Proxy(target, {
    get(_target, prop, receiver) {
      // wrapping only asynchronous functions
      if (typeof _target[prop] === "function" && isAsync(_target[prop])) {
        return async function(...args) {
          debugging.debug(() => "API call: " + JSON.stringify({
            method: prop,
            args: [...args]})
          , debugging.LOG_COLOR_CYAN);
          await preApiCall();
          let result = await _target[prop](...args);
          await postApiCall();
          return result;
        };
      }
      return _target[prop];
    }
  });
}

/**
 * @ignore
 */
const wrappedSubscriptions = wrapApiNamespace(subscriptions.default);
export {wrappedSubscriptions as subscriptions};

/**
 * @ignore
 */
const wrappedFilters = wrapApiNamespace(filters.default);
export {wrappedFilters as filters};

/**
 * @ignore
 */
const wrappedReporting = wrapApiNamespace(reporting.default);
export {wrappedReporting as reporting};

/**
 * @ignore
 */
const wrappedDebugging = wrapApiNamespace(debugging.default);
export {wrappedDebugging as debugging};

// "Allowlisting" might be used before EWE is actually started
// and it does not require pre- and post- actions.
export {default as allowlisting} from "./allowlisting.js";

/**
 * @ignore
 */
const wrappedTelemetry = wrapApiNamespace(telemetry.default);
export {wrappedTelemetry as telemetry};

/**
 * @ignore
 */
const wrappedTesting = wrapApiNamespace(testing.default);
export {wrappedTesting as testing};

// "Notifications" namespace is already a Proxy
export {notifications} from "./notifications.js";

/**
 * @ignore
 */
const wrappedCdp = wrapApiNamespace(cdp.default);
export {wrappedCdp as cdp};


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

const SKIP_INIT_RULESETS_STORAGE_KEY = "ewe:skip_init_rulesets";

/**
 * @ignore
 */
export async function clearSkipInitRulesets() {
  await browser.storage.local.remove(SKIP_INIT_RULESETS_STORAGE_KEY);
}

async function onInstalled(details) {
  // Web extension update (with potential subscriptions filter
  // text changed and repacked) can happen in the same browser session.
  // So in order to not skip the next subscriptions filter text update
  // the flag is removed.
  let manifest = browser.runtime.getManifest();
  if (details.reason != browser.runtime.OnInstalledReason.UPDATE ||
    !details.previousVersion || details.previousVersion == manifest.version) {
    return;
  }

  await clearSkipInitRulesets();
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
 *   module will only be started if this is provided. This module will send a
 *   POST request to the specified telemetry URL every 24 hours with metadata
 *   about the extension. Pings will only happen if `EWE.telemetry.setOptOut`
 *   has been called to opt the user in.
 * @param {string} [addonInfo.telemetry.url] The URL of the location where user
 * active pings will be sent to.
 * @param {string} [addonInfo.telemetry.bearer] The Bearer token accompanying
 *   telemetry API calls.
 * @param {Object?} [addonInfo.cdp] Settings for CDP.
 * @param {string} [addonInfo.cdp.aggregateUrl] The URL to send aggregate
 *   metrics to CDP.
 * @param {string} [addonInfo.cdp.pingUrl] The URL to do the user counting ping
 *   to CDP.
 * @param {string} [addonInfo.cdp.bearer] The Bearer token accompanying CDP API
 *   calls.
 * @param {Object?} [addonInfo.featureFlags] Boolean flags for enabling and
 *   disabling features. If a flag is not set here, the default value will be
 *   used. The default value is the correct state for the flag according to the
 *   SDK at time of release, so under normal circumstances these flags do not
 *   need to be set. Options may be removed from this object without it being
 *   considered a breaking change as features stabilitze and can no longer by
 *   dynamically enabled or disabled. If any features are set here which are
 *   not known features, a warning will be added to the `warnings` property
 *   of the returned `FirstRunInfo`.
 * @param {bool?} [addonInfo.featureFlags.inlineCss] Enable inline CSS in
 *   element hiding and element hiding emulation filters.
 * @return {Promise<FirstRunInfo>} Promise that is resolved after starting up
 *                                 is completed.
 */
export async function start(addonInfo) {
  let warnings = [];

  let addonInfoResult = setAddonInfo(addonInfo);
  if (addonInfoResult.warnings) {
    warnings.push(...addonInfoResult.warnings);
  }

  startSubmodulesWithListeners();

  if (browser.declarativeNetRequest) {
    browser.runtime.onInstalled.addListener(onInstalled);
    let validateSubscriptionWarnings = await validateSubscriptions(
      addonInfo.bundledSubscriptions, addonInfo.bundledSubscriptionsPath);

    if (validateSubscriptionWarnings) {
      warnings.push(...validateSubscriptionWarnings);
    }
  }

  await startSubmodules();

  let {filterStorage} = filterEngine;
  let firstRun = {
    foundSubscriptions: filterStorage.getSubscriptionCount() != 0,
    foundStorage: !filterStorage.firstRun,
    warnings
  };

  if (browser.declarativeNetRequest) {
    let migratedToMv3 = await checkAndMigrateSubscriptions();
    // If it has just migrated to MV3 there is no diff updates data,
    // so we can skip wiping it.
    await checkAndInitSubscriptions(migratedToMv3);
  }

  if (addonInfo && addonInfo.telemetry) {
    await telemetry.start(addonInfo.telemetry);
  }

  if (addonInfo && addonInfo.cdp) {
    await cdpMetricsUploader.start(addonInfo.cdp);
  }

  return firstRun;
}

function startSubmodulesWithListeners() {
  // for MV3, submodules that register event listeners generally need
  // to register their events in the first turn of the event loop to
  // register their event listeners.
  messageResponder.start();
  messageDeferrer.start();
  if (isRunningInServiceWorker()) {
    popupBlockerServiceWorker.start();
  }

  if (browser.declarativeNetRequest) {
    dnrRequestReporter.start();
  }

  sitekey.start();
  filters.start();
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
    return true;
  }
  return false;
}

/**
 * @ignore
 * @param {boolean} skipWipeOutDiffs Skip wiping diff updates data
 */
export async function checkAndInitSubscriptions(skipWipeOutDiffs) {
  // Loading the subcriptions filter text wipes out diff updates,
  // so we do it in case of web extension update only.
  let skipInit = await browser.storage.local.get(
    [SKIP_INIT_RULESETS_STORAGE_KEY]
  );
  if (skipInit[SKIP_INIT_RULESETS_STORAGE_KEY]) {
    // Rulesets state is not persisted between webext updates
    await ensureDNRRulesetsEnabled();
    return;
  }

  if (!skipWipeOutDiffs) {
    // It's a webext update, so we need to wipe out all diffs
    // and start from scratch: full state provided in bundled data.
    await clearRulesetUpdates();
    await removeSubscriptionsDynamicFilters();
    await enableAllDisabledStaticRules();
  }

  await recoverMigrationErrorSubscriptions();
  await updateSubscriptionInformation();
  await ensureDNRRulesetsEnabled();

  await subscriptions.default.sync();

  await browser.storage.local.set(
    {[SKIP_INIT_RULESETS_STORAGE_KEY]: true}
  );
}
