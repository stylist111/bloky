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
import {v4 as uuidv4} from "uuid";
import {MILLIS_IN_MINUTE} from "adblockpluscore/lib/time.js";

import * as info from "./info.js";
import {hasAcceptableAdsEnabled} from "./subscriptions.js";
import {EventDispatcher} from "./types.js";

const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
const TELEMETRY_ALARM_KEY = "ewe:telemetry";

class AlarmScheduler {
  constructor(config) {
    this.config = config;

    this.callListenerInProgress = false;

    // this has to be declared as an arrow function here because it's capturing
    // `this` in the closure.
    this.onAlarm = async alarm => {
      if (alarm.name != this.config.alarmKey) {
        return;
      }
      await this.checkSchedule();
    };

    browser.alarms.onAlarm.addListener(this.onAlarm);
    this.checkSchedule();
  }

  async checkSchedule() {
    if (this.callListenerInProgress) {
      return;
    }
    this.callListenerInProgress = true;

    try {
      let nextAlarmInfo = await this.callListenerIfItsTime();
      browser.alarms.create(this.config.alarmKey, nextAlarmInfo);
    }
    finally {
      this.callListenerInProgress = false;
    }
  }

  async callListenerIfItsTime() {
    let nextTimestamp = await this.config.getNextTimestamp();
    if (nextTimestamp && Date.now() <= nextTimestamp) {
      return {
        when: nextTimestamp
      };
    }

    let success = await this.config.listener();
    if (!success) {
      return {
        delayInMinutes: this.config.errorRetryDelayInMinutes
      };
    }

    return {
      delayInMinutes: this.config.intervalInMinutes
    };
  }

  async stop() {
    browser.alarms.onAlarm.removeListener(this.onAlarm);
    await browser.alarms.clear(this.config.alarmKey);
  }
}

let scheduler = null;
let onError = new EventDispatcher(dispatch => {});

export function start(telemetry, pingIntervalInMinutes = 60 * 12,
                      errorRetryDelayInMinutes = 60) {
  if (!telemetry.url) {
    throw new Error("No telemetry `url` provided");
  }

  if (!telemetry.bearer) {
    throw new Error("No telemetry `bearer` provided");
  }

  if (scheduler) {
    return;
  }

  scheduler = new AlarmScheduler({
    alarmKey: TELEMETRY_ALARM_KEY,
    intervalInMinutes: pingIntervalInMinutes,
    errorRetryDelayInMinutes,
    listener: () => ping(telemetry),
    async getNextTimestamp() {
      let storageResult = await browser.storage.local.get(
        [TELEMETRY_STORAGE_KEY]
      );
      let storage = storageResult[TELEMETRY_STORAGE_KEY];
      let lastPing = storage && storage.lastPing;
      let lastError = storage && storage.lastError;

      if (lastError) {
        let nextRetryAfterError = new Date(lastError).getTime() +
            (errorRetryDelayInMinutes * MILLIS_IN_MINUTE);
        let nowTimestamp = Date.now();
        let maxNextRetry = nowTimestamp +
            (errorRetryDelayInMinutes * MILLIS_IN_MINUTE);
        if (nextRetryAfterError > maxNextRetry) {
          // This shouldn't happen if the clocks are working right. It implies
          // that the system clock has been set backwards since we stored that
          // timestamp. Let's correct the storage using our current clock
          // value. We shouldn't do this with lastPing because lastPing comes
          // from the server.
          nextRetryAfterError = maxNextRetry;
          await browser.storage.local.set({
            [TELEMETRY_STORAGE_KEY]: {
              ...storage,
              lastError: (new Date(nowTimestamp)).toISOString()
            }
          });
        }

        return nextRetryAfterError;
      }
      else if (lastPing) {
        return new Date(lastPing).getTime() +
          (pingIntervalInMinutes * MILLIS_IN_MINUTE);
      }

      return null;
    }
  });
}

export async function reset() {
  await stop();
  await browser.storage.local.remove(TELEMETRY_STORAGE_KEY);
}

export async function stop() {
  if (!scheduler) {
    return;
  }

  await scheduler.stop();
  scheduler = null;
}

function truncateTimes(timestamp) {
  if (!timestamp) {
    return timestamp;
  }

  return timestamp.split("T")[0] + "T00:00:00Z";
}

async function ping(telemetry) {
  const storageResult = await browser.storage.local.get(
    [TELEMETRY_STORAGE_KEY]
  );
  const storage = storageResult[TELEMETRY_STORAGE_KEY];

  let payload = await getExtensionMetadata();
  if (storage) {
    payload.first_ping = truncateTimes(storage.firstPing);
    payload.last_ping = truncateTimes(storage.lastPing);
    payload.previous_last_ping = truncateTimes(storage.previousLastPing);
    payload.last_ping_tag = storage.lastPingTag;
  }

  let pingToken;
  try {
    pingToken = await fetchWithBearerToken(
      telemetry.url,
      telemetry.bearer,
      {payload}
    );
  }
  catch (e) {
    let lastError = (new Date()).toISOString();
    await browser.storage.local.set({
      [TELEMETRY_STORAGE_KEY]: {
        ...storage,
        lastError
      }
    });

    onError.emit({
      message: e.message,
      lastError
    });
    return false;
  }

  await browser.storage.local.set({
    [TELEMETRY_STORAGE_KEY]: {
      firstPing: (storage && storage.firstPing) || pingToken,
      lastPing: pingToken,
      previousLastPing: storage && storage.lastPing,
      lastPingTag: uuidv4()
    }
  });
  return true;
}

async function fetchWithBearerToken(url, bearer, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${bearer}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Telemetry server responded with error status ${response.status}.`
    );
  }

  const data = await response.json();
  let pingToken = data.token;

  if (!pingToken) {
    throw new Error("Telemetry server response did not include a token.");
  }

  return pingToken;
}

async function getExtensionMetadata() {
  let platform;
  let platformVersion;

  if (navigator.userAgentData) {
    const platformInfo = await navigator.userAgentData.getHighEntropyValues([
      "platform",
      "platformVersion"
    ]);

    platform = platformInfo.platform;
    platformVersion = platformInfo.platformVersion;
  }
  else {
    const platformInfo = await browser.runtime.getPlatformInfo();
    platform = platformInfo.os;
  }

  return {
    // The OS. Windows, Linux, etc.
    platform,

    // The version of the system OS.
    platform_version: platformVersion,

    // The browser. Chrome, Firefox, etc.
    application: info.application,

    // The version of the browser.
    application_version: info.applicationVersion,

    // Used to identify this specific project.
    addon_name: "eyeo-webext-ad-filtering-solution",

    // The Engine's current version. See the Dotenv plugin in webpack.config.js
    addon_version: webpackDotenvPlugin.VERSION,

    // The name of the extension using the Engine.
    extension_name: info.addonName,

    // The extension's version.
    extension_version: info.addonVersion,

    // Depends on having the acceptable ads subscription enabled.
    aa_active: await hasAcceptableAdsEnabled()
  };
}

/**
 * @typedef {Object} TelemetryPingError
 * @property {string} message The error message, describing the failure.
 * @property {string} lastError The timestamp of the error.
 */

export default {
  /**
   * Emitted when sending a telemetry ping fails.
   *
   * @event
   * @type {EventDispatcher<TelemetryPingError>}
   */
  onError
};
