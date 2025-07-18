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
import {MILLIS_IN_HOUR, MILLIS_IN_MINUTE} from "adblockpluscore/lib/time.js";
import {PersistentState} from "./persistence.js";
import {Scheduler} from "../all/scheduler.js";
import {validateRemoteConfig} from "@eyeo/remote-configuration-validator";
import {EventEmitter} from "../../adblockpluscore/lib/events.js";
import {EventDispatcher} from "./types.js";
import * as experiments from "./experiments.js";
import * as cohorts from "./cohorts/index.js";
import * as serverLogConfig from "./telemetry/server-log-config.js";

const emitter = new EventEmitter();
const remoteConfigState = new PersistentState("ewe:remote_config", browser.storage.local);
let configUrl;
let scheduler;

const UNKNOWN_COUNTRY_CODE = "unknown";

const onChanged = new EventDispatcher(dispatch => {
  emitter.on("updated", async() => {
    dispatch();
  });
});

/**
 * Generates a short Base64-encoded SHA-1 hash of a given string.
 *
 * This function hashes the input string using the SHA-1 algorithm,
 * encodes the result in Base64, and returns the first 8 characters
 * of the encoded string for use as a compact identifier.
 *
 * @param {string} str - String to hash
 * @returns {Promise<string>}
 */
async function hashString(str) {
  const sha1Buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str)
  );
  const bytes = new Uint8Array(sha1Buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.substring(0, 8);
}

/**
 * Downloads the remote configuration from a URL.
 *
 * This function attempts to fetch the configuration, using an ETag header
 * for cache validation. If the content has not changed (HTTP 304), it
 * returns metadata indicating the cache is still fresh. If successful,
 * it parses the JSON response, hashes the content to generate a revision ID,
 * and returns the configuration along with headers metadata.
 *
 * @returns {Promise<Object>}
 */
async function downloadConfig() {
  const state = await remoteConfigState.getStateLoaded();

  const headers = {};
  if (state.etag) {
    headers["if-none-match"] = state.etag;
  }

  try {
    const response = await fetch(configUrl, {headers});

    const date = response.headers.get("date");
    const etag = response.headers.get("etag");
    const countryCode = response.headers.get("X-Country-Code");

    if (response.status === 304) {
      return {cacheFresh: true, date, etag, countryCode};
    }

    if (!response.ok) {
      return {downloadError: true};
    }

    const data = await response.json();
    const revisionId = await hashString(JSON.stringify(data));

    return {data, date, etag, revisionId, countryCode};
  }
  catch (e) {
    return {downloadError: true};
  }
}

/**
 * Synchronizes the remote configuration with the local state.
 * @returns {Promise<void>}
 */
async function sync() {
  const state = await remoteConfigState.getStateLoaded();

  if (!configUrl) {
    state.lastNetworkError = new Date().toISOString();
    await remoteConfigState.save();
    return;
  }

  const {
    data,
    downloadError,
    cacheFresh,
    revisionId,
    date,
    etag,
    countryCode
  } = await downloadConfig();

  if (downloadError) {
    state.lastNetworkError = new Date().toISOString();
    await remoteConfigState.save();
    return;
  }

  delete state.lastNetworkError;

  // update the last downloaded timestamp and country code
  state.countryCode = countryCode;
  state.lastDownloaded = date ?
    new Date(date).toISOString() :
    new Date().toISOString();

  if (cacheFresh) {
    // Data hasn't changed since last sync, we need to:
    // - update the lastDownload timestamp.
    // - synchronize submodules (cohorts), in case facts have changed.
    await remoteConfigState.save();
    await syncSubmodules(cacheFresh);
    return;
  }

  // update the ETag
  state.etag = etag;

  const errors = validateRemoteConfig(data);

  if (errors && errors.length > 0) {
    state.errors = errors;
    await remoteConfigState.save();
    return;
  }

  state.errors = [];
  state.rawData = data;
  state.revisionId = revisionId;
  await remoteConfigState.save();

  // emit event to notify that the config has changed
  emitter.emit("updated");
  await syncSubmodules();
}

/**
 * Synchronizes submodules like experiments and cohorts, after the remote
 * configuration has been updated.
 *
 * @param {boolean} [cacheFresh=false] - If true, it indicates that the
 *    configuration data has not changed since the last sync
 * @returns {Promise<void>}
 */
async function syncSubmodules(cacheFresh = false) {
  // synchronize cohorts
  const cohortsConfig = await remoteConfig.getCohortsConfig();
  const countryCode = await remoteConfig.getCountryCode();
  await cohorts.sync(cohortsConfig, countryCode);

  // synchronize experiments
  if (!cacheFresh) {
    const experimentsConfig = await remoteConfig.getExperimentsConfig();
    await experiments.sync(experimentsConfig);

    const loggingConfig = await remoteConfig.getLoggingConfig();
    await serverLogConfig.sync(loggingConfig);
  }
}

/**
 * Starts the remote configuration system with periodic syncing.
 *
 * @ignore
 * @param {string} url - URL endpoint for fetching the remote config
 *    e.g. cohorts and experiments configurations
 * @param {Function} [getFacts] - Function that returns facts to be used
 *    for experiments and cohorts.
 * @param {number} [syncInterval=600000] - Interval in milliseconds between
 *    syncs
 * @param {number} [errorRetryDelay=3600000] - Interval in milliseconds between
 *    syncs if the last download had a network error.
 * @param {boolean} [disableAutosync=false] - If this is true, then syncing
 *    will only happen if you call the sync function.
 * @returns {Promise<void>}
 */
export async function start({
  url,
  getFacts = null,
  syncInterval = 10 * MILLIS_IN_MINUTE,
  errorRetryDelay = MILLIS_IN_HOUR,
  disableAutosync = false
}) {
  if (scheduler) {
    return;
  }

  configUrl = url;

  // update the facts getter for cohorts
  if (typeof getFacts === "function") {
    cohorts.setFactsGetter(getFacts);
  }

  if (disableAutosync) {
    return;
  }

  scheduler = new Scheduler({
    async listener() {
      await sync();
      return true;
    },
    async getNextTimestamp() {
      const state = await remoteConfigState.getStateLoaded();

      let lastDownloaded = state.lastDownloaded;
      let lastNetworkError = state.lastNetworkError;

      if (lastNetworkError) {
        let nextRetryAfterError = new Date(lastNetworkError).getTime() +
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
          state.lastNetworkError = new Date(nowTimestamp).toISOString();
          await remoteConfigState.save();
        }

        return nextRetryAfterError;
      }
      else if (lastDownloaded) {
        return new Date(lastDownloaded).getTime() + syncInterval;
      }

      return null;
    },
    interval: syncInterval,
    errorRetryDelay
  });
}

/**
 * Stops the remote config update scheduler
 * @ignore
 */
export function stop() {
  if (!scheduler) {
    return;
  }

  scheduler.stop();
  scheduler = null;
}

/**
 * Stops remote config update scheduler and resets the state
 * @ignore
 */
export async function reset() {
  stop();
  remoteConfigState.clearState();
}

/**
 * API to interact with the remote configuration
 * @namespace remoteConfig
 */
const remoteConfig = {
  /**
   * Represents the remote config synchronization status
   * @typedef {Object} RemoteConfigSyncStatus
   * @property {Array<string>} errors - Errors from the last remote config
   *   synchronization.
   * @property {string?} lastDownloaded - ISO formatting timestamp when remote
   *   config data was last successfully downloaded. This is also updated if
   *   the server returned a response of 304 - not modified. Undefined if there
   *   have been no successful downloads.
   * @property {string?} lastNetworkError - ISO formatting timestamp of the last
   *   download attempt if that attempt had a network error. Undefined if the
   *   last sync was successful.
   */

  /**
   * Manually triggers synchronization of remote config
   * @function
   * @returns {Promise<void>}
   */
  sync,

  /**
   * Retrieves the status of the latest synchronization of remote config
   * @returns {Promise<RemoteConfigSyncStatus>}
   */
  async getSyncStatus() {
    const state = await remoteConfigState.getStateLoaded();

    return {
      errors: state.errors || [],
      lastDownloaded: state.lastDownloaded,
      lastNetworkError: state.lastNetworkError
    };
  },

  /**
   * Emitted when remote config has changed
   * @event
   * @type {EventDispatcher<Array<string>>}
   */
  onChanged,

  /**
   * Retrieves the 2-letter country code from the remote config response.
   *    e.g. "US", "DE", etc.
   * @returns {Promise<string>}
   */
  async getCountryCode() {
    const state = await remoteConfigState.getStateLoaded();
    return state.countryCode || UNKNOWN_COUNTRY_CODE;
  },

  /**
   * Retrieves the remote config data
   * @returns {Promise<Object|null>}
   */
  async getConfig() {
    const state = await remoteConfigState.getStateLoaded();
    return state.rawData;
  },

  /**
   * Retrieves experiments config
   * @returns {Promise<Experiment[]>}
   */
  async getExperimentsConfig() {
    const state = await remoteConfigState.getStateLoaded();
    const rawData = state.rawData;

    if (!rawData || !Array.isArray(rawData.experiments)) {
      return [];
    }

    return rawData.experiments;
  },

  /**
   * Retrieves cohorts config
   * @returns {Promise<Object[]>}
   */
  async getCohortsConfig() {
    const state = await remoteConfigState.getStateLoaded();
    const rawData = state.rawData;

    if (!rawData || !Array.isArray(rawData.cohorts)) {
      return [];
    }

    return rawData.cohorts;
  },

  /**
   * Retrieves logging config
   * @returns {Promise<Object>}
   */
  async getLoggingConfig() {
    const state = await remoteConfigState.getStateLoaded();
    const rawData = state.rawData;

    if (!rawData || typeof rawData.loggingLevels !== "object") {
      return {};
    }

    return rawData.loggingLevels;
  },

  /**
   * Retrieves current remote config revision ID
   * @returns {Promise<string|null>}
   */
  async getRevisionId() {
    const state = await remoteConfigState.getStateLoaded();
    return state.revisionId || null;
  }
};

export default remoteConfig;
