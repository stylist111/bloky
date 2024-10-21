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
import {compressToUTF16} from "lz-string";
import {MILLIS_IN_MINUTE, MILLIS_IN_HOUR, MILLIS_IN_DAY, MINUTES_IN_DAY}
  from "adblockpluscore/lib/time.js";
import {toLocalISODateStringWithCutoffTime} from "adblockpluscore/lib/date.js";
import {randomInteger} from "adblockpluscore/lib/random.js";

import * as info from "./info.js";
import {Scheduler} from "../all/scheduler.js";
import {trace, warn, error} from "./debugging.js";
import {postWithBearerToken} from "./telemetry.js";
import {default as cdpMod, EVENT_SESSION_START, getData, clearData,
        log as logCdp, getLog as getCdpLog, clearLog as clearCdpLog}
  from "./cdp.js";
import {PersistentState} from "./persistence.js";
import {isFeatureEnabled} from "adblockpluscore/lib/features.js";

const CDP_STORAGE_KEY = "ewe:cdp-metrics-uploader";

// Payload limit before compression:
// assuming the compression ratio is rougly 4.6,
// so the compessed payload limit is 10 Kb
const PAYLOAD_LIMIT = 46 * 1024;

const DEBUG_CDP_FEATURE_FLAG = "debugCdp";

let storage = new PersistentState(CDP_STORAGE_KEY, browser.storage.local);
let _forceEarlyUploads = false;

/**
 * @param {boolean} value  `true` to force early uploads
 * @ignore
 */
export function setForceEarlyUploads(value) {
  _forceEarlyUploads = value;
}

let scheduler = null;

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

  if (!cdp.aggregateUrl) {
    throw new Error("No CDP `aggregateUrl` provided");
  }

  if (!cdp.bearer) {
    throw new Error("No CDP `bearer` provided");
  }

  await storage.load();
  await initializeTimeOffset();
  initializeNewSessionListener();
  initializeScheduler(cdp, errorRetryDelay);
}

async function initializeTimeOffset() {
  if (typeof storage.getState().dayCutoffMinutes == "undefined") {
    let dayCutoffMinutes = randomInteger(0, MINUTES_IN_DAY);
    logCdp(`dayCutoffMinutes=${dayCutoffMinutes}`);
    storage.getState().dayCutoffMinutes = dayCutoffMinutes;
    await storage.save();
  }
}

async function onCdpSessionStart(event) {
  let state = storage.getState();
  let now = new Date();

  let referenceDateLocal = toLocalISODateStringWithCutoffTime(
    now, state.dayCutoffMinutes
  );
  logCdp(`refDateLocal=${referenceDateLocal} for ${JSON.stringify(event)} (dayCutoffMinutes=${state.dayCutoffMinutes})`);

  if (!state.bundles) {
    state.bundles = [];
  }

  if (!state.pingBundles) {
    state.pingBundles = [];
  }

  let bundleExists = state.bundles.some(
    bundle => bundle.siteId == event.siteId &&
      bundle.referenceDateLocal == referenceDateLocal
  );

  if (bundleExists) {
    logCdp("Bundle already exists");
    return;
  }

  let scheduledSendTimestamp = new Date(referenceDateLocal).getTime() +
      state.dayCutoffMinutes * MILLIS_IN_MINUTE + // to start of day
      MILLIS_IN_DAY + // add a day to get to the end of the day
      randomInteger(0, 12 * MILLIS_IN_HOUR); // random delay of up to 12 hours

  const newAggBundle = {
    siteId: event.siteId,
    referenceDateLocal,
    utid: uuidv4(),
    scheduledSendTimestamp
  };
  logCdp(`New agg bundle: ${JSON.stringify(newAggBundle)}`);
  state.bundles.push(newAggBundle);

  let existingPingBundle = state.pingBundles.find(
    bundle => bundle.siteId == event.siteId
  );

  // We use the aggregate bundles to see if this is the first session of a day,
  // which would mean scheduling a ping. However, if there is a ping which
  // hasn't managed to send yet (eg because there are errors) then don't queue
  // another one.
  if (existingPingBundle) {
    existingPingBundle.scheduledSendTimestamp = Date.now();
  }
  else {
    if (!state.clientIds) {
      state.clientIds = {};
    }

    if (!state.clientIds[event.siteId]) {
      state.clientIds[event.siteId] = uuidv4();
    }

    const newPingBundle = {
      siteId: event.siteId,
      clientId: state.clientIds[event.siteId],
      scheduledSendTimestamp: Date.now()
    };
    logCdp(`New ping bundle: ${JSON.stringify(newPingBundle)}`);
    state.pingBundles.push(newPingBundle);
  }

  await storage.save();

  scheduler.checkNow();
}


function initializeNewSessionListener() {
  cdpMod.onCdpItem.addListener(onCdpSessionStart, {
    eventType: EVENT_SESSION_START
  });
}

function initializeScheduler(cdp, errorRetryDelay) {
  if (scheduler) {
    return;
  }

  scheduler = new Scheduler({
    interval: 0, // this causes the scheduler to always call getNextTimestamp
    errorRetryDelay,
    listener: () => uploadPendingSessionBundles(cdp),
    async getNextTimestamp() {
      logCdp("getNextTimestamp()");

      let state = storage.getState();
      let lastError = state.lastError;
      let hasAnyAggregateBundles = state.bundles &&
          state.bundles.length > 0;

      let hasAnyPingBundles = state.pingBundles &&
          state.pingBundles.length > 0;

      let nextRetryAfterError = null;
      let nextScheduledAggregateBundleSend = hasAnyAggregateBundles &&
          state.bundles
          .map(bundle => bundle.scheduledSendTimestamp)
          .reduce((a, b) => Math.min(a, b));

      let nextScheduledPingBundleSend = hasAnyPingBundles &&
          state.pingBundles
          .map(bundle => bundle.scheduledSendTimestamp)
          .reduce((a, b) => Math.min(a, b));

      let nextScheduledBundleSend = null;

      if (nextScheduledAggregateBundleSend && nextScheduledPingBundleSend) {
        nextScheduledBundleSend = Math.min(
          nextScheduledAggregateBundleSend,
          nextScheduledPingBundleSend
        );
      }
      else if (nextScheduledAggregateBundleSend) {
        nextScheduledBundleSend = nextScheduledAggregateBundleSend;
      }
      else if (nextScheduledPingBundleSend) {
        nextScheduledBundleSend = nextScheduledPingBundleSend;
      }

      logCdp(`nextScheduledAggBundleSend=${nextScheduledAggregateBundleSend}, ` +
        `nextScheduledPingBundleSend=${nextScheduledPingBundleSend}, ` +
        `nextScheduledBundleSend=${nextScheduledBundleSend}`);

      let now = Date.now();
      if (!nextScheduledBundleSend) {
        // Nothing to send right now, try again in an hour.
        logCdp("Nothing to send, try in 1h");
        return now + MILLIS_IN_HOUR;
      }

      if (lastError) {
        nextRetryAfterError = lastError + errorRetryDelay;
        let nowTimestamp = Date.now();
        let maxNextRetry = nowTimestamp + errorRetryDelay;
        if (nextRetryAfterError > maxNextRetry) {
          // This shouldn't happen if the clocks are working right. It implies
          // that the system clock has been set backwards since we stored that
          // timestamp. Let's correct the storage using our current clock
          // value.
          state.lastError = nowTimestamp;
          await storage.save();
        }
      }

      if (nextRetryAfterError) {
        const result = Math.max(
          nextRetryAfterError,
          nextScheduledBundleSend
        );
        logCdp(`return ${result}`);
        return result;
      }

      logCdp(`return ${nextScheduledBundleSend}`);
      return nextScheduledBundleSend;
    }
  });
}

async function uploadPendingSessionBundles(cdp) {
  let optOut = await cdpMod.isOptOut();
  trace({cdp, optOut});
  logCdp("uploadPendingSessionBundles()");

  let state = storage.getState();

  // slice here does a shallow clone, so we can remove elements from the
  // original in the loop
  let pingBundlesSnapshot = (state.pingBundles || []).slice(0);
  let aggregateBundlesSnapshot = (state.bundles || []).slice(0);

  let now = Date.now();

  try {
    for (let bundle of pingBundlesSnapshot) {
      if (bundle.scheduledSendTimestamp > now) {
        logCdp(`Skipping ${bundle} as it's too early (${now})`);
        continue;
      }

      if (!optOut) {
        let payload = {
          site_id: bundle.siteId,
          site_client_id: bundle.clientId,
          addon_name: info.sdkName,
          addon_version: info.sdkVersion,
          application: info.application,
          application_version: info.applicationVersion
        };

        const body = {payload};
        logCdp(`postWithBearerToken(${cdp.pingUrl})`);
        await postWithBearerToken(cdp.pingUrl, cdp.bearer, body);
      }

      state.pingBundles = state.pingBundles.filter(b => b != bundle);
      await storage.save();
    }

    for (let bundle of aggregateBundlesSnapshot) {
      if (bundle.scheduledSendTimestamp > now) {
        if (!_forceEarlyUploads) { // for testing purpose
          continue;
        }
      }

      let startTimestamp = new Date(bundle.referenceDateLocal).getTime() +
        storage.getState().dayCutoffMinutes * MILLIS_IN_MINUTE;
      let endTimestamp = startTimestamp + MILLIS_IN_DAY;

      if (!optOut) {
        // in Phase 2 data is an array of timestamps
        let sessionsCount = getData(EVENT_SESSION_START, bundle.siteId)
          .filter(t => t >= startTimestamp && t < endTimestamp)
          .length;

        let payload = {
          site_id: bundle.siteId,
          sessions_count: sessionsCount,
          reference_date_local: bundle.referenceDateLocal,
          utid: bundle.utid,
          addon_name: info.sdkName,
          addon_version: info.sdkVersion,
          application: info.application,
          application_version: info.applicationVersion
        };

        if (isFeatureEnabled(DEBUG_CDP_FEATURE_FLAG)) {
          // EXT-414
          if (sessionsCount == 0 || sessionsCount > 48) {
            logCdp(`Anomalous sessions number: ${sessionsCount} for ${bundle.siteId} on ${bundle.referenceDateLocal}`);
            const logMessages = getCdpLog();
            if (logMessages) {
              let rawLog = logMessages.join("\n");
              if (rawLog.length > PAYLOAD_LIMIT) {
                const originalLength = rawLog.length;
                rawLog = rawLog.substring(rawLog.length - PAYLOAD_LIMIT);
                warn(`Shrinked the CDP debug log from ${originalLength} to ${rawLog.length}`);
              }
              const compressedLog = compressToUTF16(rawLog);
              payload.debug = compressedLog;
              logCdp(`Compressed CDP log is of ${compressedLog.length} size instead of ${rawLog.length} size`);
            }
          }
          clearCdpLog();
        }

        const body = {payload};
        logCdp(`postWithBearerToken(${cdp.aggregateUrl})`);
        await postWithBearerToken(cdp.aggregateUrl, cdp.bearer, body);
      }

      state.bundles = state.bundles.filter(b => b != bundle);
      await storage.save();

      await clearData(EVENT_SESSION_START, bundle.siteId, endTimestamp);
    }

    if (state.lastError) {
      delete state.lastError;
      await storage.save();
    }
  }
  catch (e) {
    const message = `CDP error: ${e.message}`;
    logCdp(message);
    error(message);

    state.lastError = Date.now();
    await storage.save();

    return false;
  }

  return true;
}

async function _reset() {
  _stop();
  storage.clearState();
  await storage.save();
}

function _stop() {
  if (!scheduler) {
    return;
  }

  scheduler.stop();
  scheduler = null;
  cdpMod.onCdpItem.removeListener(onCdpSessionStart);
}

/**
 * @ignore
 */
export const Uploader = {
  start: _start,
  stop: _stop,
  reset: _reset
};
