/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module adblock-betafish/alias/subscriptionInit */

/** similar to adblockpluschrome\lib\subscriptionInit.js */

/** @module subscriptionInit */

import { Prefs } from "./prefs";
import * as info from "info";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import rulesIndex from "@eyeo/rules-utils/adblock/index/adblock.json";
import { port } from "../../adblockplusui/adblockpluschrome/lib/messaging/port.js";
import { setReadyState, ReadyState } from "../../src/testing/ready-state/background";
import * as logger from "~/utilities/background";
import { ORIGIN_ID as EXPERIMENT_FILTER_ORIGIN } from "@eyeo-fragments/filter-experiments/shared";

let firstRun;
let onlyExperimentFilters = false;
let reinitialized = false;
let dataCorrupted = false;

const serverLogger = new ewe.telemetry.ServerLogger("startup");

/**
 * Extracts a human-readable message from a caught value that isn't
 * guaranteed to be an Error.
 *
 * @param {*} ex
 * @return {string}
 */
function getErrorMessage(ex) {
  if (ex instanceof Error) return ex.message || String(ex);
  if (typeof ex === "string") return ex;
  try {
    const json = JSON.stringify(ex);
    if (typeof json === "string") return json;
  } catch {
    // fall through to String() below
  }
  return String(ex);
}

/**
 * Extracts the fulfilled value of a settled promise, or a fallback if it
 * was rejected.
 *
 * @param {PromiseSettledResult} result
 * @param {*} fallback
 * @return {*}
 */
function settledValue(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
async function detectFirstRun(foundSubscriptions, foundStorage) {
  let userFilters = await ewe.filters.getUserFilters();
  // Filters injected by the filter-experiments system aren't evidence
  // of a genuine prior run.
  let genuineUserFilters = userFilters.filter(
    (filter) => filter.metadata?.origin !== EXPERIMENT_FILTER_ORIGIN,
  );
  onlyExperimentFilters = userFilters.length > 0 && genuineUserFilters.length === 0;
  // Without stored data, anything found was added during this startup, such
  // as the subscription holding experiment filters.
  let foundPriorSubscriptions = foundSubscriptions && foundStorage;
  firstRun = !foundPriorSubscriptions && !genuineUserFilters.length;

  if (firstRun && (foundStorage || Prefs.currentVersion)) {
    reinitialized = true;
    console.warn(
      "First run looks reinitialized: subscriptions/filters are missing " +
        "but storage or a previous version marker was found",
      {
        foundSubscriptions,
        foundPriorSubscriptions,
        foundStorage,
        currentVersion: Prefs.currentVersion,
        totalUserFilters: userFilters.length,
        genuineUserFilters: genuineUserFilters.length,
      },
    );
  }

  Prefs.currentVersion = info.addonVersion;
}

/**
 * In case of data corruption, we don't want to show users
 * any non-essential notifications so we need to instruct
 * the notification manager to ignore them.
 *
 * @param {boolean} value
 */
function setDataCorrupted(value) {
  dataCorrupted = value;
  ewe.notifications.ignored = value;
}

/*
 * Remove any subscriptions that a user or administrator has added to a
 * central / common configuration (such as the Windows Registry)
 *
 * @return {Promise}
 */

function removeSubscriptions() {
  return new Promise(function (resolve, reject) {
    if ("managed" in browser.storage) {
      browser.storage.managed.get(null).then(
        async (items) => {
          for (let key in items) {
            if (key === "remove_subscriptions" && Array.isArray(items[key]) && items[key].length) {
              for (let inx = 0; inx < items[key].length; inx++) {
                if (await ewe.subscriptions.has(items[key][inx])) {
                  await ewe.subscriptions.remove(items[key][inx], {
                    reason: ewe.subscriptions.REASONS.ADMIN_POLICY,
                  });
                }
              }
            }
          }
          resolve();
        },

        // Opera doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {
          resolve();
        },
      );
    } else {
      resolve();
    }
  });
}

async function addAdditionalSubscriptions() {
  const urls = Prefs.additional_subscriptions;
  if (!Array.isArray(urls)) {
    logger.error("Invalid additional subscriptions preference");
    return;
  }

  for (const url of urls) {
    if (typeof url !== "string") {
      logger.error(`Invalid additional subscription URL: ${url}`);
      continue;
    }

    try {
      if (await ewe.subscriptions.has(url)) {
        continue;
      }

      await ewe.subscriptions.add(url, {
        reason: ewe.subscriptions.REASONS.ADMIN_POLICY,
      });
    } catch (ex) {
      logger.error(`Failed to add additional subscription: ${url}\n${ex}`);
    }
  }
}

/**
 * Attempts to fix the issue where the user has no subscriptions we expect
 * them to have at least the default subscriptions. This runs regardless of
 * firstRun/reinitialized, since those can be permanently stuck false by a
 * subscription that only holds non-genuine filters (e.g. ones injected by
 * the filter-experiments system), which getSubscriptions() below doesn't
 * return but still counts towards them.
 * See: https://eyeo.atlassian.net/browse/EXT-373
 *
 * @param {boolean} isMV3
 * @param {?string} addDefaultsErrorMsg - The error message from the
 *   proactive addDefaults() call above, or null if it wasn't attempted or
 *   succeeded.
 */
async function recoverMissingSubscriptions(isMV3, addDefaultsErrorMsg) {
  // If addDefaults() already failed above, that's confirmed evidence
  // something is wrong, so skip the proactive check and go straight to
  // the recovery attempt below. If the proactive check itself merely
  // fails to run, that's not evidence of anything - unlike a confirmed
  // empty read, it shouldn't trigger recovery and risk overwriting a
  // subscription set the user may have deliberately chosen (e.g. only a
  // non-default subscription enabled).
  let subscriptionsMissing = addDefaultsErrorMsg !== null;
  let subscriptionsConfirmedMissing = false;
  let proactiveCheckErrorMsg = null;
  if (addDefaultsErrorMsg === null) {
    try {
      subscriptionsMissing = (await ewe.subscriptions.getSubscriptions()).length === 0;
      // True only if we know subscriptions are missing, not merely that
      // we failed to check - see the reinitialized check below.
      subscriptionsConfirmedMissing = subscriptionsMissing;
    } catch (ex) {
      proactiveCheckErrorMsg = getErrorMessage(ex);
      logger.error(`Failed to check current subscriptions: ${proactiveCheckErrorMsg}`);
    }
  }
  if (!subscriptionsMissing) {
    return;
  }

  let recoveryErrorMsg = null;
  try {
    // Enable default subscriptions: EasyList, Anti-CV and Acceptable Ads
    await ewe.subscriptions.addDefaults(null, true, {
      reason: ewe.subscriptions.REASONS.RECOVERY,
    });
  } catch (e) {
    recoveryErrorMsg = getErrorMessage(e);
  }

  // Use allSettled rather than all, so that a failure reading back one piece
  // of post-recovery state (e.g. dynamic rules) doesn't discard the others
  // (e.g. an accurate subscription count) - and so it doesn't abort the
  // rest of initialization either. declarativeNetRequest is MV3-only, so
  // those two reads are skipped on MV2.
  const postRecoveryResults = await Promise.allSettled([
    ewe.subscriptions.getSubscriptions(),
    isMV3 ? browser.declarativeNetRequest.getEnabledRulesets() : Promise.resolve([]),
    ewe.filters.getUserFilters(),
    isMV3 ? browser.declarativeNetRequest.getDynamicRules() : Promise.resolve([]),
  ]);
  const [subscriptionsResult] = postRecoveryResults;
  const [newSubscriptions, enabledRulesets, userFilters, dynamicRules] = postRecoveryResults.map(
    (result) => settledValue(result, []),
  );
  const postRecoveryErrorMsgs = postRecoveryResults
    .filter((result) => result.status === "rejected")
    .map((result) => getErrorMessage(result.reason));
  const enabledSubscriptions = newSubscriptions.filter((subscription) => subscription.enabled);
  const lastErrorMsg = (browser.runtime.lastError || {}).message || null;

  // Same distinction as subscriptionsConfirmedMissing, applied to the
  // post-recovery read.
  const subscriptionsConfirmedStillMissing =
    subscriptionsResult.status === "fulfilled" && newSubscriptions.length === 0;

  // Only flag this as a reinitialization when there's actual evidence
  // something is wrong: subscriptions were confirmed missing outside of
  // a first run (nothing to lose there), the post-recovery read still
  // confirms zero subscriptions, or the recovery attempt itself failed.
  // A failure merely checking - before or after recovery - isn't
  // evidence on its own; a failure reading the other, purely diagnostic,
  // post-recovery state doesn't affect this either, it's still reported
  // below but not treated as proof anything broke.
  if (
    (subscriptionsConfirmedMissing && !firstRun) ||
    subscriptionsConfirmedStillMissing ||
    recoveryErrorMsg !== null
  ) {
    reinitialized = true;
  }

  // Report every failure that occurred, rather than letting a later
  // one hide an earlier, potentially more useful, one.
  const errorMsgs = [
    addDefaultsErrorMsg,
    proactiveCheckErrorMsg,
    recoveryErrorMsg,
    ...postRecoveryErrorMsgs,
  ].filter((msg) => msg !== null && msg !== "");
  const errorMsg = errorMsgs.length > 0 ? errorMsgs.join("; ") : null;
  const params = {
    subs: newSubscriptions.length,
    enabledSubs: enabledSubscriptions.length,
    enabledRulesets: enabledRulesets.length,
    totalUserFilters: userFilters.length,
    dynamicRules: dynamicRules.length,
    dataCorrupted: isDataCorrupted(),
    firstRun,
    reinitialized,
    errorMsg,
    lastErrorMsg,
  };

  // send a message to the log server with debug metadata
  console.warn("Something is wrong with subscriptions, reset to defaults", params);

  let initializationLogsEnabled = false;
  try {
    initializationLogsEnabled = await ewe.experiments.getFlag("initialization_logs");
  } catch (ex) {
    logger.error(`Failed to check initialization_logs flag: ${getErrorMessage(ex)}`);
  }

  if (initializationLogsEnabled) {
    serverLogger.debug("subscriptions_reset", params);
  }
}

async function addSubscriptions() {
  const isMV3 = browser.runtime.getManifest().manifest_version === 3;
  let addDefaultsErrorMsg = null;
  if (firstRun || reinitialized) {
    try {
      // Without force, an experiment filter added during startup stops the
      // defaults from being added.
      await ewe.subscriptions.addDefaults(null, onlyExperimentFilters);
    } catch (ex) {
      if (!isMV3) {
        throw ex;
      }

      // Don't let a failure here (e.g. hitting the browser's DNR static
      // rule count limit) abort the rest of initialization - the recovery
      // logic below will retry adding defaults, and report the failure.
      addDefaultsErrorMsg = getErrorMessage(ex);
      logger.error(`Failed to add default subscriptions: ${addDefaultsErrorMsg}`);
    }
  }

  await recoverMissingSubscriptions(isMV3, addDefaultsErrorMsg);

  await addAdditionalSubscriptions();
}

/**
 * We need to check whether we can safely write to/read from storage
 * before we start relying on it for storing preferences.
 */
async function testStorage() {
  let testKey = "readwrite_test";
  let testValue = Math.random();

  try {
    await browser.storage.local.set({ [testKey]: testValue });
    let result = await browser.storage.local.get(testKey);
    if (result[testKey] != testValue)
      throw new Error("Storage test: Failed to read and write value");
  } finally {
    await browser.storage.local.remove(testKey);
  }
}

const start = async function () {
  performance.mark("adblock.initialize");
  let addonInfo = {
    bundledSubscriptions: rulesIndex,
    bundledSubscriptionsPath: "/data/rules/abp",
    heavyDependenciesPath: "/vendor/@eyeo/webext-ad-filtering-solution/heavy-dependencies.js",
    name: info.addonName,
    version: info.addonVersion,
    // Bloky: no remote config (A/B experiments, in-product messages) and no accounts.
  };

  let cdp = {
    pingUrl: webpackDotenvPlugin.CDP_PING_URL,
    publicKeyUrl: webpackDotenvPlugin.CDP_PUBLIC_KEY_URL,
    bearer: webpackDotenvPlugin.CDP_BEARER,
  };

  if (cdp.pingUrl && cdp.publicKeyUrl && cdp.bearer) {
    addonInfo.cdp = cdp;
  }
  let telemetry = {
    url: webpackDotenvPlugin.EYEOMETRY_URL,
    bearer: webpackDotenvPlugin.EYEOMETRY_BEARER,
  };

  if (telemetry.url && telemetry.bearer) {
    addonInfo.telemetry = telemetry;
  }

  let telemetryEventLogging = {
    url: webpackDotenvPlugin.EYEOMETRY_EVENT_LOGGING_URL,
    bearer: webpackDotenvPlugin.EYEOMETRY_EVENT_LOGGING_BEARER,
  };

  if (telemetryEventLogging.url && telemetryEventLogging.bearer) {
    addonInfo.telemetryEventLogging = telemetryEventLogging;
  }

  return ewe.start(addonInfo).then(async (eweFirstRun) => {
    await detectFirstRun(eweFirstRun.foundSubscriptions, eweFirstRun.foundStorage);
    (await ewe.filters.getMigrationErrors()).forEach(console.error);
    (await ewe.subscriptions.getMigrationErrors()).forEach(console.error);
    eweFirstRun.errors.forEach(console.error);
    eweFirstRun.warnings.forEach(console.warn);
    await Prefs.untilLoaded.catch(() => {
      setDataCorrupted(true);
    });
    await testStorage().catch(() => {
      setDataCorrupted(true);
    });
    // adding default filter lists
    await addSubscriptions();
    await removeSubscriptions();

    setReadyState(ReadyState.started);
  });
};
const initialize = start();

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
function isDataCorrupted() {
  return dataCorrupted;
}

export { initialize, isDataCorrupted };

/**
 * @typedef {object} subscriptionsGetInitIssuesResult
 * @property {boolean} dataCorrupted
 *   true if it appears that the user's extension data was corrupted.
 * @property {boolean} reinitialized
 *   true if we have reset the user's settings due to data corruption.
 */

/**
 * Returns an Object with boolean flags for any subscription initialization
 * issues.
 *
 * @event "subscriptions.getInitIssues"
 * @returns {subscriptionsGetInitIssuesResult}
 */
port.on("subscriptions.getInitIssues", (message, sender) => ({ dataCorrupted, reinitialized }));
