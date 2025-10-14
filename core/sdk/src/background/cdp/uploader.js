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
import pako from "pako";
import {MILLIS_IN_HOUR, MILLIS_IN_DAY} from "adblockpluscore/lib/time.js";

import * as info from "../info.js";
import {Scheduler} from "../../all/scheduler.js";
import {hasAcceptableAdsEnabled} from "../subscriptions.js";
import {trace, error, debug, warn} from "../debugging.js";
import {default as experiments} from "../experiments.js";
import {default as cohorts} from "../cohorts/index.js";
import {postWithBearerToken} from "../telemetry/eyeometry.js";
import {PersistentState} from "../persistence.js";
import {init as initPrefs} from "../prefs.js";
import {getBehaviourLoggingState, clearBehaviourLoggingState, ServerLogger}
  from "../telemetry/server-logger.js";

import {isOptedOut, getDomainStats, clearData, EVENT_SESSION_START,
        EVENT_PAGE_VIEW, EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW}
  from "./index.js";
import {premiumStatusCallback} from "./callbacks.js";
import {importRSAPublicKey, encryptRSA, AES_LENGTH,
        createAESKey, generateAESNonce, AESkeyToBinary, encryptAES}
  from "./encryption.js";
import {MaxLengthMetricsDict} from "./domains-trimming.js";

let manifest = browser.runtime.getManifest();
const extensionVersion = manifest.version;

const CDP_STORAGE_KEY = "ewe:cdp-metrics-uploader-3";
const storage = new PersistentState(CDP_STORAGE_KEY, browser.storage.local);

const STATS_UNCOMPRESSED_SIZE_LIMIT = 90 * 1024;

const serverLogger = new ServerLogger("cdp");

let _cdp;
let _scheduler = null;

/**
 * Request public key from the backend
 * @ignore
 */
export async function requestPublicKey() {
  const response = await fetch(_cdp.publicKeyUrl);
  if (!response.ok) {
    throw new Error(`Failed to get public key: ${response.status}`);
  }
  const publicKey = await response.text();
  const keyId = response.headers.get("PubKey-Id");
  if (!keyId) {
    throw new Error("Failed to get public key: no pubkey-id");
  }
  return {publicKey, keyId};
}

async function compressStats(stats) {
  const gzippedArray = pako.gzip(stats, {level: 9});
  return gzippedArray.buffer;
}

async function encryptStats(publicKeyPem, stats) {
  trace({publicKeyPem});

  const publicKey = await importRSAPublicKey(publicKeyPem);
  const aesKey = await createAESKey();
  const aesKeyBinary = await AESkeyToBinary(aesKey);
  const aesNonce = generateAESNonce();
  const aesKeyBinaryBuffer = await encryptRSA(publicKey, aesKeyBinary);
  const aesKeyBinaryArray = new Uint8Array(aesKeyBinaryBuffer);

  const encryptedDataBuffer = await encryptAES(aesNonce, aesKey, stats);
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

async function getExperimentsAssignments() {
  const assignments = await experiments.getAssignments();
  return Object.entries(assignments).map(assignment => {
    return {
      experiment_id: assignment[0],
      variant_id: assignment[1]
    };
  });
}

async function buildPayload(publicKey, keyId, stats, utid) {
  trace({publicKey, keyId, utid});

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
    encryption_scheme: `rsa:2048:aes:${AES_LENGTH}`,
    // schema #4
    aa_active: await hasAcceptableAdsEnabled(),
    experiments: await getExperimentsAssignments(),
    cohorts: await cohorts.getAll()
  };

  if (premiumStatusCallback) {
    const premiumStatus = await premiumStatusCallback();
    payload.premium_status = premiumStatus ? "premium" : "free";
  }

  // the very first run is expected not to have `encrypted_data` and `last_ping`
  if (state.lastPing) {
    const gzippedStats = await compressStats(stats);
    payload.encrypted_data = await encryptStats(publicKey, gzippedStats);
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
  if (hasLastStats(state)) {
    // lastDomainStats is deprecated, but might still exist in the wild.
    delete state.lastDomainStats;
    delete state.lastStats;
  }
  if (state.lastUtid) {
    delete state.lastUtid;
  }

  if (state.retryCounter) {
    delete state.retryCounter;
  }

  await storage.save();
}

function hasLastStats(state) {
  // lastDomainStats is deprecated, but might still exist in the wild.
  return Object.prototype.hasOwnProperty.call(state, "lastStats") ||
    Object.prototype.hasOwnProperty.call(state, "lastDomainStats");
}

// event type to backend metric token mapping
const EVENT_TYPE_TO_METRIC = {
  [EVENT_SESSION_START]: "s",
  [EVENT_PAGE_VIEW]: "p",
  [EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW]: "b"
};

export async function buildStatsPayload(includeEventStats) {
  let eventStats = await getBehaviourLoggingState();

  let domainStats = getDomainStats();

  const domainStatMetrics = [
    EVENT_TYPE_TO_METRIC[EVENT_SESSION_START],
    EVENT_TYPE_TO_METRIC[EVENT_PAGE_VIEW],
    EVENT_TYPE_TO_METRIC[EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW]
  ];
  const dict = new MaxLengthMetricsDict(
    STATS_UNCOMPRESSED_SIZE_LIMIT, domainStatMetrics, includeEventStats, null
  );

  for (const [eventName, eventCount] of Object.entries(eventStats)) {
    dict.addEvent(eventName, eventCount);
  }

  for (const domainStat of domainStats) {
    for (const eventType in domainStat.stats) {
      const metric = EVENT_TYPE_TO_METRIC[eventType];
      const value = domainStat.stats[eventType];
      dict.addMetric(domainStat.domain, metric, value);
    }
  }

  let serializedPayload = dict.serialize();

  serverLogger.debug("built_cdp_payload", {
    eventStats,
    uncompressedPayloadSize: serializedPayload.length
  });

  return serializedPayload;
}

/**
 * @ignore
 */
export async function upload() {
  trace({});

  await initPrefs();
  if (isOptedOut()) {
    warn("CDP opted out, skipping");
    return false;
  }

  const state = storage.getState();
  let stats;
  let utid;
  try {
    const isRetryPing = hasLastStats(state);

    // for the very first ping stats is `null`,
    // but we save it as `null` anyway to signal that's the last sent payload,
    // so we can't use the check `if (state.lastStats)`
    if (isRetryPing) {
      // lastDomainStats is deprecated, but might still exist in the wild.
      stats = state.lastStats || state.lastDomainStats;
      utid = state.lastUtid;
      warn("Resending payload " + utid);
    }
    else {
      // for the very first ping `lastPing` is null
      if (state.lastPing) {
        let includeEventStats = await experiments.getFlag("cdp-include-event-stats");
        stats = await buildStatsPayload(includeEventStats);

        // we don't need the data anymore:
        // it will be either successfully sent or saved for retry in
        // `browser.storage.local`
        await Promise.all([
          clearData(),
          clearBehaviourLoggingState()
        ]);
      }
      else {
        // the very first ping
        stats = null;
      }
      utid = uuidv4();
      debug("New payload " + utid);
    }

    let emptyPayload = stats === '{"ds":[]}' || stats === '{"ds":[],"es":{}}';

    if (!state.lastPing || (stats && !emptyPayload)) {
      const {publicKey, keyId} = await requestPublicKey();
      const payload = await buildPayload(publicKey, keyId, stats, utid);
      await postWithBearerToken(_cdp.pingUrl, _cdp.bearer, {payload});
      await updateTimestamps(true);
    }
    else {
      warn("No data to upload, skipping");
      await updateTimestamps(false);
    }
  }
  catch (e) {
    // Not being sent to Sentry for now. If we do, we should find a way to
    // filter between unavoidable network errors and something actually being
    // wrong on the server.
    error(`CDP error: ${e.message} for payload with utid=${utid}`);

    state.retryCounter = (state.retryCounter || 0) + 1;
    if (state.retryCounter >= 3) {
      error("Retried sending too much times");
      await updateTimestamps(true);
      await storage.save();
      return true;
    }

    state.lastError = Date.now();
    if (!hasLastStats(state)) {
      state.lastStats = stats;
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
export async function start(cdp, errorRetryDelay = 1 * MILLIS_IN_HOUR) {
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

export async function reset() {
  stop();
  storage.clearState();
  await storage.save();
}

export function stop() {
  if (!_scheduler) {
    return;
  }

  _scheduler.stop();
  _scheduler = null;
}
