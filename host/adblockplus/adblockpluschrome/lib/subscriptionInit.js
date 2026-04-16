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

const serverLogger = new ewe.telemetry.ServerLogger("initialization");

let firstRun;
let userNotificationCallback = null;
let reinitialized = false;
let dataCorrupted = false;

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
  firstRun = !foundSubscriptions && !userFilters.length;

  if (firstRun && (foundStorage || Prefs.currentVersion)) reinitialized = true;

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

async function addSubscriptionsAndNotifyUser() {
  if (firstRun || reinitialized) await ewe.subscriptions.addDefaults();

  // Attempt to fix the issue where the user has no subscriptions we expect
  // them to have at least the default subscriptions.
  // See: https://eyeo.atlassian.net/browse/EXT-375
  const isMV3 = browser.runtime.getManifest().manifest_version === 3;
  if (isMV3) {
    const subscriptions = await ewe.subscriptions.getSubscriptions();
    if (subscriptions.length === 0) {
      let errorMsg = null;

      try {
        // Enable default subscriptions: EasyList, Anti-CV and Acceptable Ads
        await ewe.subscriptions.addDefaults(null, true);
      } catch (e) {
        errorMsg = e.message;
      }

      const [newSubscriptions, enabledRulesets, userFilters, dynamicRules] =
        await Promise.all([
          ewe.subscriptions.getSubscriptions(),
          browser.declarativeNetRequest.getEnabledRulesets(),
          ewe.filters.getUserFilters(),
          browser.declarativeNetRequest.getDynamicRules()
        ]);
      const enabledSubscriptions = newSubscriptions.filter(
        (subscription) => subscription.enabled
      );
      const lastErrorMsg = (browser.runtime.lastError || {}).message || null;
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
      console.warn("Something is wrong with subscriptions, reset to defaults", {
        firstRun,
        reinitialized,
        dataCorrupted
      });
      serverLogger.debug("zero_subs_reset", params);

      // reset the reinitialized flag to be later used in communicating
      // with the user
      reinitialized = true;
    }
  }

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
