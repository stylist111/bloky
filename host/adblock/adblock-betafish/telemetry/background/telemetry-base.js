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
/* global browser, channels, replacedCounts, BigInt */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { chromeStorageSetHelper } from "~/utilities/background/bg-functions";
import {
  getWebAllowlistingFilterCount,
  getPopupAllowlistingFilterCount,
  getCustomizedFilterCount,
  getWizardFilterCount,
  getMissingFilterCount,
} from "./custom-rule";

import { Prefs } from "~/alias/prefs";
import ServerMessages from "~/servermessages";
import { getSettings, settings } from "~/prefs/background";
import SubscriptionAdapter from "~/subscriptionadapter";
import { getUserId } from "~/id/background/index";
import { determineUserLanguage, storageSet, getUserAgentInfo } from "~/utilities/background/index";

const FiftyFiveMinutes = 3300000;

// Returns `aa` property which encodes the status of Acceptable Ads
// and Acceptable Ads Privacy subscriptions
export async function getAAStatus() {
  const subs = await SubscriptionAdapter.getAllSubscriptionsMinusText();
  let result;
  if (subs) {
    const aa = subs.acceptable_ads;
    const aaPrivacy = subs.acceptable_ads_privacy;

    if (!aa && !aaPrivacy) {
      result = "u"; // Both filter lists unavailable
    } else if (aa.subscribed) {
      result = "1";
    } else if (aaPrivacy.subscribed) {
      result = "2";
    } else if (!aa.subscribed && !aaPrivacy.subscribed) {
      result = "0"; // Both filter lists unsubscribed
    }
  }
  return result;
}

class TelemetryBase {
  constructor(
    totalRequestsStorageKeyArg,
    nextRequestTimeStorageKeyArg,
    alarmNameArg,
    hostURLPrefArg,
  ) {
    this.totalRequestsStorageKey = totalRequestsStorageKeyArg;
    this.nextRequestTimeStorageKey = nextRequestTimeStorageKeyArg;
    this.alarmName = alarmNameArg;
    this.hostURLPref = hostURLPrefArg;
    this.dataCorrupt = false;
    // Get some information about the version, os, and browser
    this.version = browser.runtime.getManifest().version;
    this.os = getUserAgentInfo().os;
    this.osVersion = getUserAgentInfo().osVersion;
    this.flavor = getUserAgentInfo().flavor;
    this.browserVersion = getUserAgentInfo().browserVersion;
    this.firstRun = false;
    this.userId = "";
    // added calls to these two methods because the need to be
    // called in the first turn of the event loop
    this.addAlarmListener();
  }

  addAlarmListener = () => {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm && alarm.name === this.alarmName) {
        await this.pingNow();
        await this.scheduleNextPing();
        await this.sleepThenPing();
      }
    });
  };

  // Get the user a userid.
  async loadUserID() {
    if (!this.userId) {
      this.userId = await getUserId();
    }
    return this.userId;
  }

  // Clean up / remove old, unused data in localStorage
  cleanUpLocalStorage() {
    storageSet(this.totalRequestsStorageKey);
    storageSet(this.nextRequestTimeStorageKey);
  }

  async getTelemetryData() {
    const response = await browser.storage.local.get(this.totalRequestsStorageKey);
    let data = {};
    await settings.onload();
    const settingsObj = getSettings();
    const totalPings = response[this.totalRequestsStorageKey] || 0;
    const themeOptionsPage = settingsObj.color_themes.options_page.replace("_theme", "");
    const themePopupMenu = settingsObj.color_themes.popup_menu.replace("_theme", "");
    let subsStr = "-1";
    if (typeof BigInt === "function") {
      subsStr = BigInt(`0b${await SubscriptionAdapter.getSubscriptionsChecksum()}`).toString();
    }
    await Prefs.untilLoaded;

    data = {
      u: this.userId,
      v: this.version,
      f: this.flavor,
      o: this.os,
      bv: this.browserVersion,
      ov: this.osVersion,
      ad: settingsObj.show_advanced_options ? "1" : "0",
      yt: settingsObj.youtube_channel_whitelist ? "1" : "0",
      l: determineUserLanguage(),
      pc: totalPings,
      dcv2: settingsObj.data_collection_v2 ? "1" : "0",
      ldc: settingsObj.local_data_collection ? "1" : "0",
      rc: await replacedCounts.getTotalAdsReplaced(),
      to: themeOptionsPage,
      tm: themePopupMenu,
      sy: settingsObj.sync_settings ? "1" : "0",
      ir: channels.isAnyEnabled() ? "1" : "0",
      cir: channels.channelGuide[channels.getIdByName("CustomChannel")].enabled ? "1" : "0",
      tca: settingsObj.twitch_channel_allowlist ? "1" : "0",
      sup: settingsObj.suppress_update_page ? "1" : "0",
      ss: settingsObj.suppress_surveys ? "1" : "0",
      sfrp: settingsObj.suppress_first_run_page ? "1" : "0",
      opm: settingsObj.onpageMessages ? "1" : "0",
      sendadwallmessages: Prefs.send_ad_wall_messages ? "1" : "0",
      subs: subsStr,
      customfc: await getCustomizedFilterCount(),
      missingfc: await getMissingFilterCount(),
      popfc: await getPopupAllowlistingFilterCount(),
      wafc: await getWebAllowlistingFilterCount(),
      wizardfc: await getWizardFilterCount(),
      filterMigrationErrorCount: (await ewe.filters.getMigrationErrors()).length,
      subscriptionMigrationErrorCount: (await ewe.subscriptions.getMigrationErrors()).length,
    };

    // only on Chrome, Edge, or Firefox
    if (
      (this.flavor === "E" || this.flavor === "CM" || this.flavor === "F") &&
      Prefs.blocked_total
    ) {
      data.b = Prefs.blocked_total;
    }
    if (browser.runtime.id) {
      data.extid = browser.runtime.id;
    }
    const aaStatus = await getAAStatus();
    if (aaStatus) {
      data.aa = aaStatus;
    }

    data.crctotal = 0;
    data.crcsnippet = 0;
    data.crcelemhideemulation = 0;
    data.crcelemhideexception = 0;
    data.crcelemhide = 0;
    data.crcallowing = 0;
    data.crcblocking = 0;
    data.crccomment = 0;
    data.crcinvalid = 0;

    const userFilters = await ewe.filters.getUserFilters();
    for (let j = 0; j < userFilters.length; j++) {
      const filter = userFilters[j];
      data[`crc${filter.type}`] += 1;
      data.crctotal += 1;
    }

    data.numberOfPartnerExt = Prefs.get("partnerExtensionFound").extesnionsIdsFound.length;
    // Detected in the last 7 days
    data.hasUBO = Date.now() - Prefs.get("uboDetected") < 7 * 24 * 60 * 60 * 1000 ? "1" : "0";
    // Detection was last run in the last 7 days
    data.uboDetectionWasActive =
      Date.now() - Prefs.get("uboDetectionLastRun") < 7 * 24 * 60 * 60 * 1000 ? "1" : "0";
    data.dc = this.dataCorrupt ? "1" : "0";
    data.isPinned = "-1";
    const userSettings = browser.action.getUserSettings && (await browser.action.getUserSettings());
    if (userSettings) {
      data.isPinned = userSettings.isOnToolbar ? "1" : "0";
    }
    if (browser.permissions && browser.permissions.getAll) {
      const allPermissions = await browser.permissions.getAll();
      data.dhp =
        allPermissions.origins && allPermissions.origins.includes("<all_urls>") ? "1" : "0";
    } else {
      data.dhp = "1";
    }
    return data;
  }

  // Return the number of milliseconds until the next scheduled ping.
  async millisTillNextPing() {
    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (this.dataCorrupt) {
      return FiftyFiveMinutes;
    }
    const response = await browser.storage.local.get(this.nextRequestTimeStorageKey);
    if (!response[this.nextRequestTimeStorageKey]) {
      this.firstRun = true;
    }
    let nextPingTime = response[this.nextRequestTimeStorageKey];
    if (typeof nextPingTime !== "number" || Number.isNaN(nextPingTime)) {
      nextPingTime = 0;
    }
    if (nextPingTime === 0 && this.firstRun) {
      chromeStorageSetHelper(this.nextRequestTimeStorageKey, 100);
      return 100;
    }
    // if we don't have a 'next ping time', or it's not a valid number,
    // default to 55 minute ping interval
    if (typeof nextPingTime !== "number" || nextPingTime === 0 || Number.isNaN(nextPingTime)) {
      return FiftyFiveMinutes;
    }
    return nextPingTime - Date.now();
  }

  async sleepThenPing() {
    const delay = await this.millisTillNextPing();
    browser.alarms.create(this.alarmName, { delayInMinutes: delay / 1000 / 60 });
  }

  async start() {
    await this.loadUserID();
    // Do 'stuff' when we're first installed...
    // - send a message
    const response = await browser.storage.local.get(this.totalRequestsStorageKey);
    if (!response[this.totalRequestsStorageKey]) {
      if (browser.management && browser.management.getSelf) {
        const info = await browser.management.getSelf();
        if (info) {
          ServerMessages.recordGeneralMessage(`new_install_${info.installType}`);
        } else {
          ServerMessages.recordGeneralMessage("new_install");
        }
      } else {
        ServerMessages.recordGeneralMessage("new_install");
      }
    }
    // This will sleep, then ping, then schedule a new ping, then
    // call itself to start the process over again.
    await this.sleepThenPing();
    this.cleanUpLocalStorage();
  }

  async untilLoaded() {
    await this.loadUserID();
    return this.userId;
  }

  get browser() {
    return {
      E: "Chrome",
      CM: "Edge",
      F: "Firefox",
    }[this.flavor];
  }
}

export default TelemetryBase;
