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

import {MILLIS_IN_MINUTE, MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";
import {PersistentState} from "./persistence.js";
import {Scheduler} from "../all/scheduler.js";
import {validateExperimentData} from "../all/experiment-validation.js";

let experimentData = new PersistentState("ewe:split_experiments", browser.storage.local);
let experimentUrl;
let scheduler;

async function hashString(str) {
  const sha1Buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str)
  );
  const sha1DataView = new DataView(sha1Buffer);

  // For simplicity, we only use the first 32 bits of the sha1. This is enough
  // entropy to give us a good uniform distribution.
  const sha1Subset = sha1DataView.getUint32(0);
  const unscaledRangeSize = Math.pow(2, 32);

  // We get into the 0-1000 range by multiplying and dividing, rather than
  // modulo, because modulo would introduce a bias towards the lower ends of the
  // number range.
  const scaledRangeSize = 1000;
  const hash = Math.floor(sha1Subset * scaledRangeSize / unscaledRangeSize);

  return hash;
}

/**
 * @ignore
 * Sets the seed for the current client
 * @param {string} id - Seed ID
 */
export async function setSeed(id) {
  const state = await experimentData.getStateLoaded();
  state.seed = id;
  state.etag = null; // This busts the cache to force reassignment.
  await experimentData.save();
}

async function getSeed() {
  const state = await experimentData.getStateLoaded();

  if (!state.seed) {
    state.seed = uuidv4();
    await experimentData.save();
  }

  return state.seed;
}

async function assignVariants(experiments) {
  const seed = await getSeed();
  const flags = {};
  const assignments = {};

  for (const experiment of experiments) {
    if (experiment.enabled === false) {
      continue;
    }

    const mod = await hashString(`${seed}:${experiment.experimentId}`);

    for (const variant of experiment.variants) {
      if (mod >= variant.mods[0] && mod < variant.mods[1]) {
        Object.assign(flags, variant.flags);
        assignments[experiment.experimentId] = variant.variantId;
        break;
      }
    }
  }

  return {flags, assignments};
}

/**
 *
 * @ignore
 * Starts the experiment system with periodic syncing
 * @param {string} url - URL endpoint for fetching experiment configurations
 * @param {number} [syncInterval=600000] - Interval in milliseconds between
 * syncs
 * @param {number} [errorRetryDelay] - Interval in milliseconds between syncs if
 * the last download had a network error.
 */
export function start(url, syncInterval = 10 * MILLIS_IN_MINUTE,
                      errorRetryDelay = MILLIS_IN_HOUR) {
  if (scheduler) {
    return;
  }

  experimentUrl = url;

  scheduler = new Scheduler({
    async listener() {
      await syncData();
      return true;
    },
    async getNextTimestamp() {
      const state = await experimentData.getStateLoaded();

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
          await experimentData.save();
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
 * @ignore
 */
export async function reset() {
  stop();
  experimentData.clearState();
  await experimentData.save();
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

async function downloadExperimentsFile() {
  const state = await experimentData.getStateLoaded();

  const headers = {};
  if (state.etag) {
    headers["if-none-match"] = state.etag;
  }

  try {
    const response = await fetch(experimentUrl, {headers});

    const date = response.headers.get("date");
    const etag = response.headers.get("etag");

    if (response.status === 304) {
      return {cacheFresh: true, date, etag};
    }

    if (!response.ok) {
      return {downloadError: true};
    }

    const data = await response.json();

    return {newExperimentData: data, date, etag};
  }
  catch (e) {
    return {downloadError: true};
  }
}

/**
 * Synchronizes experiment data using the experimentUrl configured
 * @returns {Promise<void>}
 */
async function syncData() {
  const state = await experimentData.getStateLoaded();

  if (!experimentUrl) {
    state.lastNetworkError = new Date().toISOString();
    await experimentData.save();
    return;
  }

  const {downloadError, cacheFresh, newExperimentData: data, date, etag} =
        await downloadExperimentsFile();

  if (downloadError) {
    state.lastNetworkError = new Date().toISOString();
    await experimentData.save();
    return;
  }

  delete state.lastNetworkError;

  if (date) {
    state.lastDownloaded = new Date(date).toISOString();
  }
  else {
    state.lastDownloaded = new Date().toISOString();
  }

  if (cacheFresh) {
    // Data hasn't changed since last sync, so nothing to update except the
    // lastDownload timestamp.
    await experimentData.save();
    return;
  }

  state.etag = etag;
  state.rawData = data;

  const {errors} = validateExperimentData(data);

  if (errors && errors.length > 0) {
    state.errors = errors;
    await experimentData.save();
    return;
  }

  state.errors = [];
  const {flags, assignments} = await assignVariants(data.experiments);
  state.flags = flags;
  state.assignments = assignments;

  await experimentData.save();
}

/**
 * API to interact with split experiments
 * @namespace experiments
 */
export default {
  /**
   * Represents the experiment data synchronization status
   * @typedef {Object} ExperimentSyncStatus
   * @property {Array<string>} errors Errors from the last experiments
   *   synchronization.
   * @property {string?} lastDownloaded ISO formatting timestamp when experiment
   *   data was last successfully downloaded. This is also updated if the server
   *   returned a response of 304 - not modified. Undefined if there have been
   *   no successful downloads.
   * @property {string?} lastNetworkError ISO formatting timestamp of the last
   *   download attempt if that attempt had a network error. Undefined if the
   *   last sync was successful.
   */

  /**
   * Manually triggers synchronization of experiment data
   * @returns {Promise<void>}
   */
  async sync() {
    await syncData();
  },

  /**
   * Retrieves the status of the latest synchronization of experiment data
   * @returns {Promise<ExperimentSyncStatus>} Experiment data synchronization
   *   status
   */
  async getSyncStatus() {
    const state = await experimentData.getStateLoaded();

    return {
      lastNetworkError: state.lastNetworkError,
      lastDownloaded: state.lastDownloaded,
      errors: state.errors || []
    };
  },

  /**
   * Retrieves the value of a feature flag
   * @param {string} flagId - Identifier of the feature flag
   * @returns {Promise<*|null>} Value of the feature flag or null if not found
   */
  async getFlag(flagId) {
    const state = await experimentData.getStateLoaded();

    if (state && state.overrides && typeof state.overrides[flagId] !== "undefined") {
      return state.overrides[flagId];
    }

    if (state && state.flags && typeof state.flags[flagId] !== "undefined") {
      return state.flags[flagId];
    }

    return null;
  },

  /**
   * Overrides a feature flag value
   * @param {string} flagId - Identifier of the feature flag to override
   * @param {*} value - New value for the feature flag
   * @returns {Promise<void>}
   */
  async overrideFlag(flagId, value) {
    const state = await experimentData.getStateLoaded();

    if (!state.overrides) {
      state.overrides = {};
    }

    state.overrides[flagId] = value;
    await experimentData.save();
  },

  /**
   * Clears all feature flag overrides
   * @returns {Promise<void>}
   */
  async clearFlagOverrides() {
    const state = await experimentData.getStateLoaded();
    state.overrides = {};
    await experimentData.save();
  },

  /**
   * Retrieves current experiment variant assignments for the current client
   * @returns {Promise<Object.<string, string>>} Object specifying the assigned
   *   variant ID for each active assigned experiment ID
   * @example
   * await ewe.experiments.getAssignments();
   * // returns { "experiment1": "variant1", "experiment2": "variant2" }
   */
  async getAssignments() {
    const state = await experimentData.getStateLoaded();
    return state.assignments || {};
  }
};
