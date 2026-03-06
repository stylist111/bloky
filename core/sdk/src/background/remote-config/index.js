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

import {MILLIS_IN_HOUR, MILLIS_IN_MINUTE} from "#adblockpluscore/lib/time.js";
import {getNextRequestTimestamp, Scheduler} from "../../all/scheduler.js";
import {validateRemoteConfig} from "@eyeo/remote-configuration-validator";
import {EventEmitter} from "../../../adblockpluscore/lib/events.js";
import {EventDispatcher} from "../types.js";
import * as experiments from "../experiments.js";
import * as cohorts from "../cohorts/index.js";
import * as serverLogConfig from "../telemetry/server-log-config.js";
import {
  getCohortsConfig,
  getConfig,
  getCountryCode,
  getExperimentsConfig,
  getIpmCommands,
  getLoggingConfig,
  getRevisionId,
  getSyncStatus,
  remoteConfigState,
  setFactsGetter
} from "./storage.js";
import {hashString} from "../../all/hashing.js";

const emitter = new EventEmitter();
let configUrl;
let scheduler;

const onChanged = new EventDispatcher(dispatch => {
  emitter.on("updated", async() => {
    dispatch();
  });
});

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

  // We need to run any post-processing before notifying others that the config
  // has changed to ensure that, at that time, all the data that's based on the
  // contents of the remote config is consistent
  await syncSubmodules();

  // emit event to notify that the config has changed
  emitter.emit("updated");
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
  // Modules that require synchronization even if the cache is fresh,
  // because they depend on facts that might have changed from the last sync.
  await cohorts.sync();
  await experiments.sync();

  // Below are modules that don't have conditions to re-evaluate, so we only
  // synchronize them if the cache is not fresh
  // (i.e. the config data has changed since the last sync)
  if (!cacheFresh) {
    await serverLogConfig.sync();
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

  // update the facts getter (used by both cohorts and experiments)
  if (typeof getFacts === "function") {
    setFactsGetter(getFacts);
  }

  // initialize the server log config when starting the service worker
  await serverLogConfig.sync();

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

      const {
        nextCheckTimestamp,
        lastRequestError: updatedNetworkError
      } = getNextRequestTimestamp({
        lastSuccessfulRequest: lastDownloaded,
        lastRequestError: lastNetworkError,
        errorRetryDelay,
        syncInterval
      });

      if (updatedNetworkError) {
        state.lastNetworkError = updatedNetworkError;
        await remoteConfigState.save();
      }

      return nextCheckTimestamp;
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
   * @function
   * @returns {Promise<RemoteConfigSyncStatus>}
   */
  getSyncStatus,

  /**
   * Emitted when remote config has changed
   * @event
   * @type {EventDispatcher<Array<string>>}
   */
  onChanged,

  /**
   * Retrieves the 2-letter country code from the remote config response.
   *    e.g. "US", "DE", etc.
   * @function
   * @returns {Promise<string>}
   */
  getCountryCode,

  /**
   * Retrieves the remote config data
   * @function
   * @returns {Promise<Object|null>}
   */
  getConfig,

  /**
   * Retrieves experiments config
   * @function
   * @returns {Promise<Experiment[]>}
   */
  getExperimentsConfig,

  /**
   * Retrieves cohorts config
   * @function
   * @returns {Promise<Object[]>}
   */
  getCohortsConfig,

  /**
   * Retrieves in-product messaging commands
   * @function
   * @returns {Promise<Object[]|null>}
   */
  getIpmCommands,

  /**
   * Retrieves logging config
   * @function
   * @returns {Promise<Object>}
   */
  getLoggingConfig,

  /**
   * Retrieves current remote config revision ID
   * @function
   * @returns {Promise<string|null>}
   */
  getRevisionId,

  /**
   * Sets URL endpoint for fetching the remote config
   * @function
   * @param {string} url - URL endpoint for fetching the remote config
   */
  setUrl(url) {
    configUrl = url;
  }
};

export default remoteConfig;
