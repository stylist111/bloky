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
import {MILLIS_IN_MINUTE, MILLIS_IN_HOUR, MILLIS_IN_DAY, MINUTES_IN_DAY}
  from "adblockpluscore/lib/time.js";
import {toLocalISODateStringWithCutoffTime} from "adblockpluscore/lib/date.js";
import {randomInteger} from "adblockpluscore/lib/random.js";

import * as info from "./info.js";
import {Scheduler} from "./scheduler.js";
import {trace, error} from "./debugging.js";
import {postWithBearerToken} from "./telemetry.js";
import {default as cdpMod, EVENT_SESSION_START, getData, clearData} from "./cdp.js";
import {PersistentState} from "./persistence.js";

const CDP_STORAGE_KEY = "ewe:cdp-metrics-uploader";
let storage = new PersistentState(CDP_STORAGE_KEY, browser.storage.local);

let _forceEarlyUploads = false;

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
export async function start(cdp, errorRetryDelay = 1 * MILLIS_IN_HOUR) {
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
    return;
  }

  let scheduledSendTimestamp = new Date(referenceDateLocal).getTime() +
      state.dayCutoffMinutes * MILLIS_IN_MINUTE + // to start of day
      MILLIS_IN_DAY + // add a day to get to the end of the day
      randomInteger(0, 12 * MILLIS_IN_HOUR); // random delay of up to 12 hours

  state.bundles.push({
    siteId: event.siteId,
    referenceDateLocal,
    utid: uuidv4(),
    scheduledSendTimestamp
  });

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

    state.pingBundles.push({
      siteId: event.siteId,
      clientId: state.clientIds[event.siteId],
      scheduledSendTimestamp: Date.now()
    });
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

      let now = Date.now();
      if (!nextScheduledBundleSend) {
        // Nothing to send right now, try again in an hour.
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

      if (nextScheduledBundleSend) {
        return Math.max(
          nextRetryAfterError,
          nextScheduledBundleSend
        );
      }

      return nextScheduledBundleSend;
    }
  });
}

async function uploadPendingSessionBundles(cdp) {
  let optOut = await cdpMod.isOptOut();
  trace({cdp, optOut});

  let state = storage.getState();

  // slice here does a shallow clone, so we can remove elements from the
  // original in the loop
  let pingBundlesSnapshot = (state.pingBundles || []).slice(0);
  let aggregateBundlesSnapshot = (state.bundles || []).slice(0);

  let now = Date.now();

  try {
    for (let bundle of pingBundlesSnapshot) {
      if (bundle.scheduledSendTimestamp > now) {
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
        await postWithBearerToken(cdp.pingUrl, cdp.bearer, {payload});
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
        await postWithBearerToken(cdp.aggregateUrl, cdp.bearer, {payload});
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
    error(`CDP error: ${e.message}`);

    state.lastError = Date.now();
    await storage.save();

    return false;
  }

  return true;
}

/**
 * @ignore
 */
export async function reset() {
  stop();
  storage.clearState();
  await storage.save();
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
  cdpMod.onCdpItem.removeListener(onCdpSessionStart);
}
