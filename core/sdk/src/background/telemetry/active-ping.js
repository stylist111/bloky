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
import {MILLIS_IN_HOUR, MILLIS_IN_DAY} from "#adblockpluscore/lib/time.js";

import * as info from "../info.js";
import {Prefs, init as initializePrefs} from "../prefs.js";
import {Scheduler} from "../../all/scheduler.js";
import {default as initializer} from "../initializer.js";
import {trace, error} from "../debugging.js";

import {getExtensionMetadata, postWithBearerToken} from "./eyeometry.js";

const TELEMETRY_STORAGE_KEY = "ewe:telemetry";

let scheduler = null;

async function clearStorage() {
  await browser.storage.local.remove(TELEMETRY_STORAGE_KEY);
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
  payload.addon_name = info.sdkName;
  payload.addon_version = info.sdkVersion;

  if (storage) {
    payload.first_ping = truncateTimes(storage.firstPing);
    payload.last_ping = truncateTimes(storage.lastPing);
    payload.previous_last_ping = truncateTimes(storage.previousLastPing);
    payload.last_ping_tag = storage.lastPingTag;
  }
  payload.ucid = (storage && storage.ucid) || uuidv4();

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
    // Not being sent to Sentry for now. If we do, we should find a way to
    // filter between unavoidable network errors and something actually being
    // wrong on the server.
    error(`Telemetry error: ${e.message}`);

    let lastError = (new Date()).toISOString();
    await browser.storage.local.set({
      [TELEMETRY_STORAGE_KEY]: {
        ...storage,
        lastError
      }
    });

    return false;
  }

  let newStorage = {
    firstPing: (storage && storage.firstPing) || pingToken,
    lastPing: pingToken,
    previousLastPing: storage && storage.lastPing,
    lastPingTag: uuidv4(),
    ucid: payload.ucid
  };

  await browser.storage.local.set({
    [TELEMETRY_STORAGE_KEY]: newStorage
  });
  return true;
}

/**
 * @ignore
 * @param {boolean} value The new opt out value
 */
export async function setOptOut(value) {
  if (scheduler && !value) {
    scheduler.checkNow();
  }

  if (value) {
    await clearStorage();
  }
}
