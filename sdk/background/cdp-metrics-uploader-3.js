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

import * as info from "./info.js";
import {Scheduler} from "../all/scheduler.js";
import {trace, error, debug, warn} from "./debugging.js";
import {postWithBearerToken} from "./telemetry.js";
import {default as cdpMod, getDomainStats, clearData} from "./cdp.js";
import {importRSAPublicKey, encryptRSA, AES_LENGTH,
        createAESKey, generateAESNonce, AESkeyToBinary, encryptAES}
  from "./cdp-encryption.js";
import {PersistentState} from "./persistence.js";

let manifest = browser.runtime.getManifest();
const extensionVersion = manifest.version;

const CDP_STORAGE_KEY = "ewe:cdp-metrics-uploader-3";
const storage = new PersistentState(CDP_STORAGE_KEY, browser.storage.local);

let _cdp;
let _scheduler = null;

/**
 * Request public key from the backend
 * @ignore
 */
export async function requestPublicKey() {
  let response = await fetch(_cdp.publicKeyUrl);
  const publicKey = await response.text();
  const keyId = response.headers.get("PubKey-Id");
  return {publicKey, keyId};
}

async function encryptDomainStats(publicKeyPem, domainStats) {
  trace({publicKeyPem});

  const publicKey = await importRSAPublicKey(publicKeyPem);
  const aesKey = await createAESKey();
  const aesKeyBinary = await AESkeyToBinary(aesKey);
  const aesNonce = generateAESNonce();
  const aesKeyBinaryBuffer = await encryptRSA(publicKey, aesKeyBinary);
  const aesKeyBinaryArray = new Uint8Array(aesKeyBinaryBuffer);

  const encryptedDataBuffer = await encryptAES(aesNonce, aesKey, domainStats);
  const encryptedDataArray = new Uint8Array(encryptedDataBuffer);

  const encryptedCombo = new Uint8Array(
    aesKeyBinaryArray.length + aesNonce.length + encryptedDataArray.length);
  encryptedCombo.set(aesKeyBinaryArray);
  encryptedCombo.set(aesNonce, aesKeyBinaryArray.length);
  encryptedCombo.set(encryptedDataArray,
                     aesKeyBinaryArray.length + aesNonce.length);
  // to Base64
  const result = btoa(String.fromCharCode.apply(null, encryptedCombo));
  debug(() => result);
  return result;
}

async function buildPayload(publicKey, keyId, domainStats, utid) {
  const state = storage.getState();
  const payload = {
    public_key_id: keyId,
    addon_name: info.sdkName,
    addon_version: info.sdkVersion,
    application: info.application,
    application_version: info.applicationVersion,
    extension_name: browser.runtime.id,
    extension_version: extensionVersion,
    utid,
    ucid: state.ucid,
    encryption_scheme: `rsa:2048:aes:${AES_LENGTH}`
  };

  // the very first run is expected not to have `encrypted_data` and `last_ping`
  if (state.lastPing) {
    payload.encrypted_data = await encryptDomainStats(publicKey, domainStats);
    payload.last_ping = new Date(state.lastPing).toISOString();
  }

  debug(() => "CDP payload: " + JSON.stringify(payload));
  return payload;
}

function getNextPing() {
  const state = storage.getState();
  const now = Date.now();

  // The default rate is 1 ping every 24 hours.
  // If there were no data to send we might have skipped ping(s).
  // So `nextPing` is calculated in the future starting `lastPing`
  // with 24 hours step.
  let nextPing;
  let days = 0;
  do {
    days += 1;
    nextPing = (state.lastPing || now) + days * MILLIS_IN_DAY;
  }
  while (nextPing < now);
  return nextPing;
}

async function updateTimestamps(updateLastPing) {
  trace({});

  const state = storage.getState();
  state.nextPing = getNextPing();
  if (updateLastPing) {
    state.lastPing = Date.now();
  }

  // clean-up the error if any
  if (state.lastError) {
    delete state.lastError;
  }
  if (hasLastDomainStats(state)) {
    delete state.lastDomainStats;
  }
  if (state.lastUtid) {
    delete state.lastUtid;
  }

  await storage.save();
}

function hasLastDomainStats(state) {
  return Object.prototype.hasOwnProperty.call(state, "lastDomainStats");
}

/**
 * @ignore
 */
export async function upload() {
  trace({});

  if (await cdpMod.isOptOut()) {
    warn("CDP opted out, skipping");
    return false;
  }

  const state = storage.getState();
  let domainStats;
  let utid;
  try {
    const isRetryPing = hasLastDomainStats(state);

    // for the very first ping domainStats is `null`,
    // but we save it as `null` anyway to signal that's the last sent payload,
    // so we can't use the check `if (state.lastDomainStats)`
    if (isRetryPing) {
      domainStats = state.lastDomainStats;
      utid = state.lastUtid;
      warn("Resending payload " + utid);
    }
    else {
      // for the very first ping `lastPing` is null
      if (state.lastPing) {
        domainStats = getDomainStats();

        // we don't need the data anymore:
        // it will be either successfully sent or saved for retry in
        // `browser.storage.local`
        await clearData();
      }
      else {
        // the very first ping
        domainStats = null;
      }
      utid = uuidv4();
      debug("New payload " + utid);
    }

    // if we don't have domain stats, domainStats = "[]"
    // (empty JSON array, 2 characters)
    if (!state.lastPing || (domainStats && domainStats.length > 2)) {
      const {publicKey, keyId} = await requestPublicKey();
      const payload = await buildPayload(publicKey, keyId, domainStats, utid);
      await postWithBearerToken(_cdp.pingUrl, _cdp.bearer, {payload});
      await updateTimestamps(true);
    }
    else {
      warn("No data to upload, skipping");
      await updateTimestamps(false);
    }
  }
  catch (e) {
    error(`CDP error: ${e.message} for payload with utid=${utid}`);

    state.lastError = Date.now();
    if (!hasLastDomainStats(state)) {
      state.lastDomainStats = domainStats;
      state.lastUtid = utid;
    }
    await storage.save();

    return false;
  }
  return true;
}

function initializeScheduler(errorRetryDelay) {
  if (_scheduler) {
    return;
  }

  _scheduler = new Scheduler({
    interval: 0, // this causes the scheduler to always call getNextTimestamp
    errorRetryDelay,
    listener: () => upload(),
    async getNextTimestamp() {
      let state = storage.getState();
      let lastError = state.lastError;
      let now = Date.now();

      if (lastError) {
        let nextRetryAfterError = lastError + errorRetryDelay;
        warn(`CDP ping retrying in ${errorRetryDelay} millis`);
        let maxNextRetry = now + errorRetryDelay;
        if (nextRetryAfterError > maxNextRetry) {
          // This shouldn't happen if the clocks are working right. It implies
          // that the system clock has been set backwards since we stored that
          // timestamp. Let's correct the storage using our current clock
          // value.
          state.lastError = now;
          await storage.save();
        }
        return nextRetryAfterError;
      }

      if (!state.nextPing) {
        // first run ever
        state.nextPing = getNextPing();
        await storage.save();
        return 0; // now!
      }

      return state.nextPing; // updated on a successful upload
    }
  });
}

async function initializeUcid() {
  if (!storage.getState().ucid) {
    storage.getState().ucid = uuidv4();
    await storage.save();
  }
}

/**
 * Starts CDP, which will trigger sending aggregated metrics to the CDP
 * server on a schedule.
 *
 * @param {Object} cdp CDP configuration (URLs, bearer)
 * @param {number} errorRetryDelay
 *        Error retry interval in milliseconds
 * @ignore
 */
async function _start(cdp, errorRetryDelay = 1 * MILLIS_IN_HOUR) {
  if (!cdp.pingUrl) {
    throw new Error("No CDP `pingUrl` provided");
  }

  if (!cdp.publicKeyUrl) {
    throw new Error("No CDP `publicKeyUrl` provided");
  }

  if (!cdp.bearer) {
    throw new Error("No CDP `bearer` provided");
  }

  _cdp = cdp;

  storage.clearState();
  await storage.load();
  await initializeUcid();
  initializeScheduler(errorRetryDelay);
}

async function _reset() {
  _stop();
  storage.clearState();
  await storage.save();
}

function _stop() {
  if (!_scheduler) {
    return;
  }

  _scheduler.stop();
  _scheduler = null;
}

/**
 * @ignore
 */
export const Uploader = {
  start: _start,
  stop: _stop,
  reset: _reset
};
