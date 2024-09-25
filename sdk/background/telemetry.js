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
import {MILLIS_IN_HOUR, MILLIS_IN_DAY} from "adblockpluscore/lib/time.js";

import {Prefs, init as initializePrefs} from "./prefs.js";
import * as info from "./info.js";
import {hasAcceptableAdsEnabled} from "./subscriptions.js";
import {EventDispatcher} from "./types.js";
import {Scheduler} from "../all/scheduler.js";
import {default as initializer} from "./initializer.js";
import {trace, error} from "./debugging.js";
import {isFeatureEnabled} from "adblockpluscore/lib/features.js";

const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
const TELEMETRY_UCID_FEATURE_FLAG = "eyeometryUcid";

let scheduler = null;
let ucid = null;
let onError = new EventDispatcher(dispatch => {});

async function initializeUcid() {
  let storageResult = await browser.storage.local.get(
    [TELEMETRY_STORAGE_KEY]
  );
  let storage = storageResult[TELEMETRY_STORAGE_KEY];
  ucid = storage && storage.ucid;
  if (!ucid) {
    ucid = uuidv4();
    storage = {
      ...storage,
      ucid
    };
    await browser.storage.local.set({
      [TELEMETRY_STORAGE_KEY]: storage
    });
  }
}

/**
 * @ignore
 * Starts the telemetry
 *
 * @param {Object} telemetry Telemetry configuration (URL, bearer)
 * @param {number} [interval]
 *        Ping interval in milliseconds (default: 12 hours)
 * @param {number} [errorRetryDelay]
 *        Error retry interval in milliseconds (default: 1 hour)
 */
export async function start(telemetry, interval = 12 * MILLIS_IN_HOUR,
                            errorRetryDelay = 1 * MILLIS_IN_HOUR) {
  if (!telemetry.url) {
    throw new Error("No telemetry `url` provided");
  }

  if (!telemetry.bearer) {
    throw new Error("No telemetry `bearer` provided");
  }

  if (scheduler) {
    return;
  }

  await initializePrefs();
  if (isFeatureEnabled(TELEMETRY_UCID_FEATURE_FLAG)) {
    await initializeUcid();
  }

  scheduler = new Scheduler({
    interval,
    errorRetryDelay,
    listener: () => ping(telemetry),
    async getNextTimestamp() {
      if (Prefs.telemetry_opt_out) {
        return Date.now() + MILLIS_IN_DAY;
      }

      let storageResult = await browser.storage.local.get(
        [TELEMETRY_STORAGE_KEY]
      );
      let storage = storageResult[TELEMETRY_STORAGE_KEY];
      let lastPing = storage && storage.lastPing;
      let lastError = storage && storage.lastError;

      if (lastError) {
        let nextRetryAfterError = new Date(lastError).getTime() +
            errorRetryDelay;
        let nowTimestamp = Date.now();
        let maxNextRetry = nowTimestamp + errorRetryDelay;
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
        return new Date(lastPing).getTime() + interval;
      }

      return null;
    }
  });
}

/**
 * @ignore
 */
export async function reset() {
  stop();
  await browser.storage.local.remove(TELEMETRY_STORAGE_KEY);
}

/**
 * @ignore
 */
export function stop() {
  if (!scheduler) {
    return;
  }

  scheduler.stop();
  scheduler = null;
}

function truncateTimes(timestamp) {
  if (!timestamp) {
    return timestamp;
  }

  return timestamp.split("T")[0] + "T00:00:00Z";
}

async function ping(telemetry) {
  trace({telemetry});
  await initializer.start();

  // This is a last line to ensure that we don't ever send a ping if someone has
  // opted out, even if the details of the scheduler change in the future. The
  // main opt out mechanism is telling the scheduler if it's time to ping or
  // not.
  if (Prefs.telemetry_opt_out) {
    return false;
  }

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

  if (isFeatureEnabled(TELEMETRY_UCID_FEATURE_FLAG)) {
    payload.ucid = ucid;
  }

  let pingToken;
  try {
    let serverResponse = await postWithBearerToken(
      telemetry.url,
      telemetry.bearer,
      {payload}
    );
    pingToken = serverResponse.token;

    if (!pingToken) {
      throw new Error("Telemetry server response did not include a token.");
    }
  }
  catch (e) {
    error(`Telemetry error: ${e.message}`);

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

  let newStorage = {
    firstPing: (storage && storage.firstPing) || pingToken,
    lastPing: pingToken,
    previousLastPing: storage && storage.lastPing,
    lastPingTag: uuidv4()
  };
  if (isFeatureEnabled(TELEMETRY_UCID_FEATURE_FLAG)) {
    newStorage.ucid = ucid;
  }

  await browser.storage.local.set({
    [TELEMETRY_STORAGE_KEY]: newStorage
  });
  return true;
}

/**
 * Uses the fetch API to make a POST request to the specified endpoint.
 *
 * @param {string} url URL for the request.
 * @param {string} bearer Bearer token for use in Authentication header.
 * @param {Object} body Request body, will be serialized into JSON to send.
 * @return {Promise<Object>} Promise resolves with the object returned from the
 *   server. Rejects if the request fails, or the response has an error status.
 * @ignore
 */
export async function postWithBearerToken(url, bearer, body) {
  trace({url, bearer, body});
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

  return await response.json();
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
    addon_name: info.sdkName,

    // The Engine's current version. See the Dotenv plugin in webpack.config.js
    addon_version: info.sdkVersion,

    // The name of the extension using the Engine.
    extension_name: info.addonName,

    // The extension's version.
    extension_version: info.addonVersion,

    // Depends on having the acceptable ads subscription enabled.
    aa_active: await hasAcceptableAdsEnabled()
  };
}

export default {
  /**
  * @typedef {Object} TelemetryPingError
  * @property {string} message The error message, describing the failure.
  * @property {string} lastError The timestamp of the error.
  */

  /**
   * Emitted when sending a telemetry ping fails.
   *
   * @event
   * @type {EventDispatcher<TelemetryPingError>}
   */
  onError,

  /**
   * Opt-out from telemetry. Default is `true` (used opted out)
   * @param {boolean} value Pass `true` to opt-out, pass `false` to opt in.
   * @returns {Promise} Promise that resolves when the setting is set.
   */
  async setOptOut(value) {
    Prefs.telemetry_opt_out = value;

    if (scheduler && !value) {
      scheduler.checkNow();
    }
  }
};
