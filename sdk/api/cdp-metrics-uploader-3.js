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
import {Scheduler} from "./scheduler.js";
import {trace, error, debug, warn} from "./debugging.js";
import {postWithBearerToken} from "./telemetry.js";
import {getDomainStats, clearData} from "./cdp.js";
import {importRSAPublicKey, encryptRSA, AES_LENGTH,
        createAESKey, generateAESNonce, AESkeyToBinary, encryptAES}
  from "./cdp-encryption.js";
import {PersistentState} from "./persistence.js";

let manifest = browser.runtime.getManifest();
const extensionName = manifest.name;
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

async function buildPayload(publicKey, keyId, domainStats) {
  const state = storage.getState();
  const payload = {
    public_key_id: keyId,
    addon_name: info.sdkName,
    addon_version: info.sdkVersion,
    application: info.application,
    application_version: info.applicationVersion,
    extension_name: extensionName,
    extension_version: extensionVersion,
    utid: uuidv4(),
    ucid: state.ucid,
    encryption_scheme: `rsa:2048:aes:${AES_LENGTH}`
  };

  // the very first run is expected not to have `encrypted_data` and `last_ping`
  if (state.lastPing) {
    payload.encrypted_data = await encryptDomainStats(publicKey, domainStats);
    payload.last_ping = new Date(state.lastPing).toISOString();
  }

  debug(() => JSON.stringify(payload));
  return payload;
}

function getNextPing() {
  const state = storage.getState();
  const now = Date.now();

  // 1 ping every 24 hours
  return (state.lastPing || now) + 1 * MILLIS_IN_DAY;
}

async function updateTimestamps() {
  trace({});

  const state = storage.getState();
  state.nextPing = getNextPing();
  state.lastPing = Date.now();
  if (state.lastError) {
    delete state.lastError;
  }

  await storage.save();
}

/**
 * @ignore
 */
export async function upload() {
  trace({});

  const state = storage.getState();
  try {
    const domainStats = state.lastPing ? getDomainStats() : null;
    // if we don't have domain stats, domainStats = "[]"
    // (empty JSON array, 2 characters)
    if (!state.lastPing || (domainStats && domainStats.length > 2)) {
      const {publicKey, keyId} = await requestPublicKey();

      const payload = await buildPayload(publicKey, keyId, domainStats);
      await postWithBearerToken(_cdp.pingUrl, _cdp.bearer, {payload});

      await clearData();
    }
    else {
      warn("No data to upload, skipping");
    }
    await updateTimestamps();

    debug("Save CDP payload");
  }
  catch (e) {
    error(`CDP error: ${e.message}`);

    state.lastError = Date.now();
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
