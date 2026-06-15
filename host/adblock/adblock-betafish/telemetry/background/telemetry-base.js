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
/* global browser */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { chromeStorageSetHelper } from "~/utilities/background/bg-functions";

import { Prefs } from "~/alias/prefs";
import SubscriptionAdapter from "~/subscriptionadapter";
import { getUserId } from "~/id/background/index";
import { determineUserLanguage, storageSet, getUserAgentInfo } from "~/utilities/background/index";

const FiftyFiveMinutes = 3300000;

const serverLogger = new ewe.telemetry.ServerLogger("customer_lifecycle");

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

  // Returns the total number of pings sent so far. Used to throttle the ping
  // frequency for very high-count clients (see Telemetry.pingNow). Previously
  // this was read from the ping payload's `pc` field; it is now read directly
  // so it no longer needs to be sent to the server.
  async getTotalPings() {
    const response = await browser.storage.local.get(this.totalRequestsStorageKey);
    return response[this.totalRequestsStorageKey] || 0;
  }

  async getTelemetryData() {
    // AdBlock ping compliance: only the fields required for Monthly Active
    // Client (billing) counting are sent. Diagnostic / UI / feature-flag
    // parameters were removed — the diagnostic data product relied on now
    // flows through the compliant eyeometry events instead.
    let data = {};
    await Prefs.untilLoaded;

    data = {
      u: this.userId,
      v: this.version,
      f: this.flavor,
      o: this.os,
      l: determineUserLanguage(),
    };

    if (browser.runtime.id) {
      data.extid = browser.runtime.id;
    }
    const aaStatus = await getAAStatus();
    if (aaStatus) {
      data.aa = aaStatus;
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
          serverLogger.behavior(`new_install_${info.installType}`);
        } else {
          serverLogger.behavior("new_install_unknown");
        }
      } else {
        serverLogger.behavior("new_install_unknown");
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
