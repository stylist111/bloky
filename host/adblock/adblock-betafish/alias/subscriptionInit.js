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
import ServerMessages from "~/servermessages";
import { start as startIPMPingListener } from "../../src/testing/ping-ipm/background";
import * as logger from "~/utilities/background";
import { getFacts } from "../../src/remote-config/background";

let firstRun;
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
                  await ewe.subscriptions.remove(items[key][inx]);
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

      await ewe.subscriptions.add(url);
    } catch (ex) {
      logger.error(`Failed to add additional subscription: ${url}\n${ex}`);
    }
  }
}

async function addSubscriptions() {
  if (firstRun || reinitialized) {
    await ewe.subscriptions.addDefaults();
  }

  // Attempt to fix the issue where the user has no subscriptions we expect them to have
  // at least the default subscriptions.
  // See: https://eyeo.atlassian.net/browse/EXT-373
  const isMV3 = browser.runtime.getManifest().manifest_version === 3;
  if (isMV3) {
    const subscriptions = await ewe.subscriptions.getSubscriptions();
    if (subscriptions.length === 0) {
      let errorMsg;

      try {
        // Enable default subscriptions: EasyList, Anti-CV and Acceptable Ads
        await ewe.subscriptions.addDefaults(null, true);
      } catch (e) {
        errorMsg = e.message;
      }

      const [newSubscriptions, enabledRulesets, userFilters, dynamicRules] = await Promise.all([
        ewe.subscriptions.getSubscriptions(),
        browser.declarativeNetRequest.getEnabledRulesets(),
        ewe.filters.getUserFilters(),
        browser.declarativeNetRequest.getDynamicRules(),
      ]);
      const enabledSubscriptions = newSubscriptions.filter((subscription) => subscription.enabled);
      const lastErrorMsg = (browser.runtime.lastError || {}).message;
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
      ServerMessages.recordGeneralMessage("zero_subs_reset", null, params);

      // reset the reinitialized flag to be later used in communicating with the user
      reinitialized = true;
    }
  }

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
  let addonInfo = {
    bundledSubscriptions: rulesIndex,
    bundledSubscriptionsPath: "/data/rules/abp",
    name: info.addonName,
    version: info.addonVersion,
    remoteConfig: {
      url: "https://easylist-downloads.adblockplus.org/ab-testing/experiments.json",
      getFacts,
    },
    featureFlags: {
      inlineCss: false,
    },
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

  return ewe.start(addonInfo).then(async (eweFirstRun) => {
    await detectFirstRun(eweFirstRun.foundSubscriptions, eweFirstRun.foundStorage);
    (await ewe.filters.getMigrationErrors()).forEach(console.error);
    (await ewe.subscriptions.getMigrationErrors()).forEach(console.error);
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
    startIPMPingListener();

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
