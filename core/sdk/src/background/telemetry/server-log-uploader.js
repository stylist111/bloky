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

import {MILLIS_IN_SECOND, MILLIS_IN_MINUTE, MILLIS_IN_HOUR} from "#adblockpluscore/lib/time.js";
import {getExtensionMetadata, postWithBearerToken} from "./eyeometry.js";
import {buildClientAttributes} from "./client-attributes.js";
import {onLogQueued, hasPendingLogs, startUploadTransaction,
        commitUploadTransaction, abortUploadTransaction}
  from "./server-logger.js";
import {PersistentState} from "../persistence.js";
import {default as remoteConfig} from "../remote-config/index.js";
import {default as cohorts} from "../cohorts/index.js";
import {default as serverLogConfig} from "./server-log-config.js";
import {Scheduler} from "../../all/scheduler.js";
import {Prefs, init as initializePrefs} from "../prefs.js";

const ERROR_RETRY_ATTEMPTS = 3;

let storage = new PersistentState("ewe:telemetry-server-log-uploader",
                                  browser.storage.local);

let scheduler = null;
function onLogQueuedCallback() {
  if (scheduler) {
    scheduler.checkNow();
  }
}

export function start(debugTelemetry, interval = 10 * MILLIS_IN_SECOND,
                      errorRetryDelay = 5 * MILLIS_IN_MINUTE) {
  if (!debugTelemetry.url) {
    throw new Error("No debug telemetry `url` provided");
  }

  if (!debugTelemetry.bearer) {
    throw new Error("No debug telemetry `bearer` provided");
  }

  if (scheduler) {
    return;
  }

  scheduler = new Scheduler({
    interval,
    errorRetryDelay,
    listener: () => sendServerLogs(debugTelemetry),
    async getNextTimestamp() {
      let state = await storage.getStateLoaded();
      let lastSuccess = state && state.lastSuccess;
      let lastError = state && state.lastError;

      let nowTimestamp = Date.now();

      if (lastError) {
        let nextRetryAfterError = lastError + errorRetryDelay;
        let maxNextRetry = nowTimestamp + errorRetryDelay;
        if (nextRetryAfterError > maxNextRetry) {
          // This shouldn't happen if the clocks are working right. It implies
          // that the system clock has been set backwards since we stored that
          // timestamp. Let's correct the storage using our current clock
          // value. We shouldn't do this with lastPing because lastPing comes
          // from the server.
          nextRetryAfterError = maxNextRetry;
          state.lastError = nowTimestamp;
          await storage.save();
        }

        return nextRetryAfterError;
      }

      if (lastSuccess) {
        return lastSuccess + interval;
      }

      if (!await hasPendingLogs()) {
        return nowTimestamp + MILLIS_IN_HOUR;
      }

      return null;
    }
  });

  onLogQueued.addListener(onLogQueuedCallback);
}

export function stop() {
  if (!scheduler) {
    return;
  }

  onLogQueued.removeListener(onLogQueuedCallback);
  scheduler.stop();
  scheduler = null;
}

export async function reset() {
  stop();
  storage.clearState();
  await startUploadTransaction();
  await commitUploadTransaction();
  await storage.save();
}

export async function isRunning() {
  return !!scheduler;
}


async function sendServerLogs(debugTelemetry) {
  if (!await hasPendingLogs()) {
    return true;
  }

  await initializePrefs();

  if (Prefs.telemetry_opt_out) {
    await startUploadTransaction();
    await commitUploadTransaction();
    return true;
  }

  let state = await storage.getStateLoaded();
  if (!state.nextUtid) {
    state.nextUtid = uuidv4();
    await storage.save();
  }

  let {url, bearer} = debugTelemetry;
  let items = await startUploadTransaction();

  let metadata = await getExtensionMetadata();
  metadata.remote_config_revision = await remoteConfig.getRevisionId();
  metadata.cohorts = await cohorts.getAll();
  metadata.client_attributes = await buildClientAttributes();

  const payload = {
    rotating_client_id: await serverLogConfig.getRotatingClientId(),
    utid: state.nextUtid,
    error_count: state.errorCount || 0,
    items,
    root_logging_enabled: true,
    ...metadata
  };

  try {
    await postWithBearerToken(
      url,
      bearer,
      {payload}
    );

    delete state.lastError;
    state.errorCount = 0;
    state.lastSuccess = Date.now();
    state.nextUtid = uuidv4();
    await commitUploadTransaction();
    await storage.save();
  }
  catch (e) {
    state.lastError = Date.now();
    state.errorCount = (state.errorCount || 0) + 1;

    if (state.errorCount >= ERROR_RETRY_ATTEMPTS) {
      state.errorCount = 0;
      delete state.lastError;
      state.nextUtid = uuidv4();
      await commitUploadTransaction();
    }
    else {
      await abortUploadTransaction();
    }

    await storage.save();
    return false;
  }

  return true;
}
