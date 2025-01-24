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

/* For ESLint: List any global identifiers used in this file below */
/* global browser  */
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { Prefs } from "~/alias/prefs";
import { getUserFilters } from "~/filter-utils";
import { getUserId } from "~/id/background/index";
import LocalDataCollection from "~/localdatacollection";
import { adblockIsPaused } from "../../../src/pause/background/index";
import { License, channels } from "~/picreplacement/check";
import SyncService from "~/picreplacement/sync-service";
import { getSettings } from "~/prefs/background";
import SubscriptionAdapter from "~/subscriptionadapter";
import { TELEMETRY } from "~/telemetry/background";

import { IPM_CONSTANTS, NO_DATA } from "./constants";

const getAdblockSettings = function () {
  const adblockSettings = {};
  const settingsObj = getSettings();
  for (const [key, value] of Object.entries(settingsObj)) {
    adblockSettings[key] = JSON.stringify(value);
  }

  return adblockSettings;
};

const getBuildType = function () {
  // Is this installed build of AdBlock the official one?
  if (browser.runtime.id === "pljaalgmajnlogcgiohkhdmgpomjcihk") {
    return " Beta";
  }

  if (
    browser.runtime.id === "gighmmpiobklfepjocnamgkkbiglidom" ||
    browser.runtime.id === "aobdicepooefnbaeokijohmhjlleamfj" ||
    browser.runtime.id === "ndcileolkflehcjpmjnfbnaibdcgglog" ||
    browser.runtime.id === "jid1-NIfFY2CA8fy1tg@jetpack"
  ) {
    return " Stable";
  }

  return " Unofficial";
};

async function getCustomFilterMetaData(currentUserFilters) {
  if (!currentUserFilters || currentUserFilters.length === 0) {
    return Promise.resolve({});
  }
  return Promise.all(
    /* eslint-disable-next-line consistent-return */
    currentUserFilters.map(async (rule) => {
      if (rule && rule.text) {
        const metaData = await ewe.filters.getMetadata(rule.text);
        if (!metaData) {
          return { text: rule.text };
        }

        return { text: rule.text, metaData };
      }
    }),
  );
}

const getCustomFilters = async function (userFilters) {
  if (userFilters && userFilters.length) {
    return userFilters.map((filter) => filter.text).join("\n");
  }

  return NO_DATA;
};

const getDebugAlarmInfo = async () => {
  const response = {};
  const alarms = await browser.alarms.getAll();
  if (alarms && alarms.length > 0) {
    response["Alarm info"] = `length: ${alarms.length}`;
    for (let i = 0; i < alarms.length; i++) {
      const alarm = alarms[i];
      response[`${i} Alarm Name`] = alarm.name;
      response[`${i} Alarm Scheduled Time`] = new Date(alarm.scheduledTime).toLocaleString();
    }
  } else {
    response["No alarm info"] = "No alarm info";
  }
  return response;
};

const getDebugLicenseInfo = async () => {
  const response = {};
  response.licenseInfo = {};
  response.licenseInfo.extensionGUID = await getUserId();
  response.licenseInfo.licenseId = License.get() && License.get().licenseId;
  response.licenseInfo.licenseState = License.get() && License.get().status;
  response.licenseInfo.licenseVersion = License.get() && License.get().lv;
  const syncInfo = {};
  syncInfo.SyncCommitVersion = SyncService.getCommitVersion();
  syncInfo.SyncCommitName = SyncService.getCurrentExtensionName();
  syncInfo.SyncCommitLog = await SyncService.getSyncLog();
  response.syncInfo = syncInfo;
  response["License Installation Date"] = await License.getLicenseInstallationDate();
  const customChannelId = channels.getIdByName("CustomChannel");
  if (
    customChannelId &&
    channels.getGuide()[customChannelId] &&
    channels.getGuide()[customChannelId].enabled
  ) {
    const customChannel = channels.channelGuide[customChannelId].channel;
    const result = await customChannel.getTotalBytesInUse();
    response["Custom Channel total bytes in use"] = result;
  }
  return response;
};

const getExcludeFilters = async function () {
  const excludeFiltersKey = "exclude_filters";
  const secondResponse = await browser.storage.local.get(excludeFiltersKey);
  if (secondResponse && secondResponse[excludeFiltersKey]) {
    return secondResponse[excludeFiltersKey];
  }

  return NO_DATA;
};

const getHostPermissions = async function () {
  if (browser.permissions && browser.permissions.getAll) {
    const allPermissions = await browser.permissions.getAll();
    return allPermissions;
  }

  return NO_DATA;
};

const getIPMData = function () {
  const IPMEntries = IPM_CONSTANTS.map((entry) => [entry, Prefs[entry]]);
  return Object.fromEntries(IPMEntries);
};

const getJavascriptErrors = async function (errorKey) {
  const errorResponse = await browser.storage.local.get(errorKey);
  if (errorResponse && errorResponse[errorKey]) {
    return errorResponse[errorKey];
  }

  return NO_DATA;
};

const getLocalStorageInfo = function () {
  let localStorageInfo;

  if (typeof localStorage !== "undefined" && localStorage.length) {
    localStorageInfo = {};
    localStorageInfo.length = localStorage.length;

    let inx = 1;
    for (const key in localStorage) {
      localStorageInfo[`key${inx}`] = key;
      inx += 1;
    }
  } else {
    localStorageInfo = NO_DATA;
  }

  return localStorageInfo;
};

const getMigrationMessages = async function () {
  const response = {};
  response.migrationErrors = {};
  const { migrationErrors } = response;
  migrationErrors.filters = await ewe.filters.getMigrationErrors();
  migrationErrors.subscriptions = await ewe.subscriptions.getMigrationErrors();
  return response;
};

const getSubscriptionInfo = async function () {
  const subscriptionInfo = {};
  const subscriptions = await SubscriptionAdapter.getSubscriptionsMinusText();
  for (const id in subscriptions) {
    if (subscriptions[id].subscribed) {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  return subscriptionInfo;
};

const getTotalPings = async function () {
  const storageResponse = await browser.storage.local.get("total_pings");
  return storageResponse.totalPings || 0;
};

// Get debug info as a JSON object for bug reporting and ad reporting
const getDebugInfo = function () {
  return new Promise(async (resolve) => {
    const response = {};
    const userFilters = await getUserFilters();

    // Get subscribed filter lists
    response.subscriptions = await getSubscriptionInfo();

    // Get custom/user filter rules
    response.customFilters = await getCustomFilters(userFilters);

    // Get settings
    response.settings = getAdblockSettings();
    response.prefs = JSON.stringify(Prefs);

    // Add exclude filters
    response.excludedFilters = await getExcludeFilters();

    // Add IPM info
    response.ipmInfo = getIPMData();

    response.otherInfo = {};
    let { otherInfo } = response;

    // Get build type
    otherInfo.buildtype = getBuildType();

    // Get AdBlock version
    otherInfo.version = browser.runtime.getManifest().version;

    // Get system telemetry
    otherInfo.browser = TELEMETRY.browser;
    otherInfo.browserVersion = TELEMETRY.browserVersion;
    otherInfo.osVersion = TELEMETRY.osVersion;
    otherInfo.os = TELEMETRY.os;

    otherInfo.localStorageInfo = getLocalStorageInfo();
    otherInfo.isAdblockPaused = adblockIsPaused();

    // Get 'Stats' size
    otherInfo.rawStatsSize = await LocalDataCollection.getRawStatsSize();

    // Get total pings
    otherInfo.totalPings = await getTotalPings();

    // Add JavaScript exception error
    const errorKey = "errorkey";
    otherInfo[errorKey] = await getJavascriptErrors(errorKey);

    // Add any migration messages (if there are any)
    otherInfo = Object.assign(otherInfo, await getMigrationMessages());

    otherInfo.alarmInfo = await getDebugAlarmInfo();
    otherInfo.hostPermissions = await getHostPermissions();

    otherInfo.licenseInfo = await getDebugLicenseInfo();
    otherInfo.customRuleMetaData = await getCustomFilterMetaData(userFilters);

    const blockageStats = (await browser.storage.local.get("blockage_stats")).blockage_stats;
    if (blockageStats && blockageStats.start) {
      otherInfo.extensionInstallTimestamp = new Date(blockageStats.start).toLocaleString();
    }
    resolve(response);
  });
};

export { getCustomFilterMetaData, getDebugInfo, getUserFilters };
