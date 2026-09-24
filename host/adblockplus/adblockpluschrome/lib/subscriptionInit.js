/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module subscriptionInit */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import * as premium from "../../src/premium/background/index.ts";
import { startOptionLinkListener } from "../../src/options/background";
import { info } from "../../src/info/background";
import { port } from "~/core/messaging/background";
import { revalidateAllowlistingStates } from "./allowlisting.js";
import { initDisabledFilterCounters } from "./filterConfiguration.js";
import { initNotifications } from "./notificationHelper.js";
import { Prefs } from "./prefs.js";
import { start as startFacts } from "../../src/remote-config/background";
import { start as startUnloadCleanup } from "../../src/unload-cleanup/background/index.ts";
import * as logger from "../../src/logger/background";
import { ORIGIN_ID as EXPERIMENT_FILTER_ORIGIN } from "@eyeo-fragments/filter-experiments/shared";

const serverLogger = new ewe.telemetry.ServerLogger("startup");

let firstRun;
let userNotificationCallback = null;
let reinitialized = false;
let dataCorrupted = false;

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
 *
 * @param {boolean} foundSubscriptions
 * @param {boolean} foundStorage
 *
 * @return {Promise}
 */
async function detectFirstRun(foundSubscriptions, foundStorage) {
  let userFilters = await ewe.filters.getUserFilters();
  // Filters injected by the filter-experiments system aren't evidence
  // of a genuine prior run.
  let genuineUserFilters = userFilters.filter(
    (filter) => filter.metadata?.origin !== EXPERIMENT_FILTER_ORIGIN
  );
  firstRun = !foundSubscriptions && !genuineUserFilters.length;

  if (firstRun && (foundStorage || Prefs.currentVersion)) {
    reinitialized = true;
    console.warn(
      "First run looks reinitialized: subscriptions/filters are missing " +
        "but storage or a previous version marker was found",
      {
        foundSubscriptions,
        foundStorage,
        currentVersion: Prefs.currentVersion,
        totalUserFilters: userFilters.length,
        genuineUserFilters: genuineUserFilters.length
      }
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
      if (await ewe.subscriptions.has(url)) continue;

      await ewe.subscriptions.add(url);
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
 * See: https://eyeo.atlassian.net/browse/EXT-375
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
      subscriptionsMissing =
        (await ewe.subscriptions.getSubscriptions()).length === 0;
      // True only if we know subscriptions are missing, not merely that
      // we failed to check - see the reinitialized check below.
      subscriptionsConfirmedMissing = subscriptionsMissing;
    } catch (ex) {
      proactiveCheckErrorMsg = getErrorMessage(ex);
      logger.error(
        `Failed to check current subscriptions: ${proactiveCheckErrorMsg}`
      );
    }
  }
  if (!subscriptionsMissing) return;

  let recoveryErrorMsg = null;
  try {
    // Enable default subscriptions: EasyList, Anti-CV and Acceptable Ads
    await ewe.subscriptions.addDefaults(null, true);
  } catch (e) {
    recoveryErrorMsg = getErrorMessage(e);
  }

  // Use allSettled rather than all, so that a failure reading back one
  // piece of post-recovery state (e.g. dynamic rules) doesn't discard
  // the others (e.g. an accurate subscription count) - and so it
  // doesn't abort the rest of initialization either. declarativeNetRequest
  // is MV3-only, so those two reads are skipped on MV2.
  const postRecoveryResults = await Promise.allSettled([
    ewe.subscriptions.getSubscriptions(),
    isMV3
      ? browser.declarativeNetRequest.getEnabledRulesets()
      : Promise.resolve([]),
    ewe.filters.getUserFilters(),
    isMV3
      ? browser.declarativeNetRequest.getDynamicRules()
      : Promise.resolve([])
  ]);
  const [subscriptionsResult] = postRecoveryResults;
  const [newSubscriptions, enabledRulesets, userFilters, dynamicRules] =
    postRecoveryResults.map((result) => settledValue(result, []));
  const postRecoveryErrorMsgs = postRecoveryResults
    .filter((result) => result.status === "rejected")
    .map((result) => getErrorMessage(result.reason));
  const enabledSubscriptions = newSubscriptions.filter(
    (subscription) => subscription.enabled
  );
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
  )
    reinitialized = true;

  // Report every failure that occurred, rather than letting a later
  // one hide an earlier, potentially more useful, one.
  const errorMsgs = [
    addDefaultsErrorMsg,
    proactiveCheckErrorMsg,
    recoveryErrorMsg,
    ...postRecoveryErrorMsgs
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
    lastErrorMsg
  };

  // send a message to the log server with debug metadata
  console.warn(
    "Something is wrong with subscriptions, reset to defaults",
    params
  );
  let initializationLogsEnabled = false;
  try {
    initializationLogsEnabled = await ewe.experiments.getFlag(
      "initialization_logs"
    );
  } catch (ex) {
    logger.error(
      `Failed to check initialization_logs flag: ${getErrorMessage(ex)}`
    );
  }

  if (initializationLogsEnabled)
    serverLogger.debug("subscriptions_reset", params);
}

async function addSubscriptionsAndNotifyUser() {
  const isMV3 = browser.runtime.getManifest().manifest_version === 3;
  let addDefaultsErrorMsg = null;
  if (firstRun || reinitialized) {
    try {
      await ewe.subscriptions.addDefaults();
    } catch (ex) {
      if (!isMV3) throw ex;

      // Don't let a failure here (e.g. hitting the browser's DNR static
      // rule count limit) abort the rest of initialization - the recovery
      // logic below will retry adding defaults, and report the failure.
      addDefaultsErrorMsg = getErrorMessage(ex);
      logger.error(
        `Failed to add default subscriptions: ${addDefaultsErrorMsg}`
      );
    }
  }

  await recoverMissingSubscriptions(isMV3, addDefaultsErrorMsg);

  await addAdditionalSubscriptions();

  if (userNotificationCallback)
    userNotificationCallback({ dataCorrupted, firstRun, reinitialized });
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

function initElementHidingDebugMode() {
  Prefs.on("elemhide_debug", () => {
    void ewe.debugging.setElementHidingDebugMode(Prefs.elemhide_debug);
  });

  void ewe.debugging.setElementHidingDebugMode(Prefs.elemhide_debug);
  void ewe.debugging.setElementHidingDebugStyle(
    [
      ["background", "#e67370"],
      ["outline", "solid #f00"]
    ],
    [
      [
        "background",
        `
        repeating-linear-gradient(
          to bottom,
          #e67370 0,
          #e67370 9px,
          #fff 9px,
          #fff 10px
        )
      `
      ],
      ["outline", "solid #f00"]
    ]
  );
}

export async function start(eweFirstRun) {
  await Promise.all([
    Prefs.untilLoaded.catch(() => {
      setDataCorrupted(true);
    }),
    testStorage().catch(() => {
      setDataCorrupted(true);
    })
  ]);

  (await ewe.filters.getMigrationErrors()).forEach(console.error);
  (await ewe.subscriptions.getMigrationErrors()).forEach(console.error);
  eweFirstRun.errors.forEach(console.error);
  eweFirstRun.warnings.forEach(console.warn);
  await detectFirstRun(
    eweFirstRun.foundSubscriptions,
    eweFirstRun.foundStorage
  );
  await addSubscriptionsAndNotifyUser();
  revalidateAllowlistingStates();

  await initDisabledFilterCounters();
  initElementHidingDebugMode();
  await initNotifications(firstRun);
  premium.start();
  ewe.cdp.setPremiumStatusCallback(
    async () => await premium.hasActiveLicense()
  );
  startOptionLinkListener();
  startFacts();
  startUnloadCleanup();

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
  port.on("subscriptions.getInitIssues", (message, sender) => ({
    dataCorrupted,
    reinitialized
  }));
}

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
export function isDataCorrupted() {
  return dataCorrupted;
}

/**
 * Sets a callback that is called with environment information after
 * initialization to notify users.
 *
 * @param {function} callback
 */
export function setNotifyUserCallback(callback) {
  userNotificationCallback = callback;
}
