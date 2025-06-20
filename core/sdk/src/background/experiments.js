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

import {EventEmitter} from "adblockpluscore/lib/events.js";
import {PersistentState} from "./persistence.js";
import {EventDispatcher} from "./types.js";
import sentry from "./sentry.js";
import {warn} from "./debugging.js";
import {base64Encode} from "./set-operations.js";

let _experimentsConfig = [];
let emitter = new EventEmitter();
let experimentData = new PersistentState("ewe:split_experiments", browser.storage.local);

let onChanged = new EventDispatcher(dispatch => {
  emitter.on("updated", async() => {
    dispatch(await getExperimentsInternal());
  });
});

async function modHashString(str) {
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

    const mod = await modHashString(`${seed}:${experiment.experimentId}`);

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

async function getExperimentsInternal() {
  const state = await experimentData.getStateLoaded();
  const assignments = state.assignments || {};

  const experiments = _experimentsConfig.map(experiment => {
    const variants = experiment.variants.map(variant => {
      return {
        id: variant.variantId,
        assigned: assignments[experiment.experimentId] === variant.variantId
      };
    });

    return {
      id: experiment.experimentId,
      variants
    };
  });

  return experiments;
}

async function getEncodedExperiments() {
  const state = await experimentData.getStateLoaded();
  const assignments = state.assignments || {};

  const bitArray = _experimentsConfig.flatMap(experiment =>
    experiment.variants.map(variant =>
      assignments[experiment.experimentId] === variant.variantId ? 1 : 0
    )
  );

  return base64Encode(bitArray);
}

/**
 * @ignore
 */
export async function reset() {
  _experimentsConfig = [];
  experimentData.clearState();
  await experimentData.save();
}

/**
 * Assigns the current client to the variants of the experiments
 *
 * @param {Array<Object>} config - Array of experiments configuration
 *
 * @ignore
 * @returns {Promise<void>}
 */
export async function sync(config) {
  // store in memory the experiments config, to be later used
  _experimentsConfig = config;

  try {
    const state = await experimentData.getStateLoaded();
    const {flags, assignments} = await assignVariants(config);
    state.flags = flags;
    state.assignments = assignments;

    await experimentData.save();

    emitter.emit("updated");
  }
  catch (e) {
    warn(`Error while synchronizing experiments: ${e.message}`);
    sentry.reportError(e);
  }
}

/**
 * API to interact with split experiments
 * @namespace experiments
 */
export default {
  /**
   * Represents an experiment
   * @typedef {Object} Experiment
   * @property {string} id Experiment ID.
   * @property {Array.<ExperimentVariant>} variants Experiment variants.
   */

  /**
   * Represents a variant of an experiment
   * @typedef {Object} ExperimentVariant
   * @property {string} id Experiment variant ID.
   * @property {boolean} assigned Indicates whether current user is assigned to
   *   the experiment variant.
   */

  /**
   * Manually triggers synchronization of experiment data
   *
   * @function
   * @param {Array<Object>} config - Array of experiments configuration.
   * @returns {Promise<void>}
   */
  sync,

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
   * Retrieves all feature flags, including overridden flags
   * @returns {Promise<Object>} Object specifying all of
   *          the feature flag IDs and their values
   *          (or an empty object)
   */
  async getFlags() {
    let state = await experimentData.getStateLoaded();

    if (!state) {
      return {};
    }

    return {...state.flags, ...state.overrides};
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

    if (state.overrides[flagId] === value) {
      return;
    }

    state.overrides[flagId] = value;
    await experimentData.save();

    emitter.emit("updated");
  },

  /**
   * Clears all feature flag overrides
   * @returns {Promise<void>}
   */
  async clearFlagOverrides() {
    const state = await experimentData.getStateLoaded();

    if (!state.overrides || Object.keys(state.overrides).length === 0) {
      return;
    }

    state.overrides = {};
    await experimentData.save();

    emitter.emit("updated");
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
  },

  /**
   * Retrieves current experiments
   * @returns {Promise<Array.<Experiment>>} Current experiments
   * @example
   * await ewe.experiments.getExperiments();
   * // returns [ {
   * //   "id": "experiment1",
   * //   "variants": [ {
   * //     "id": "variant1",
   * //     "assigned": true
   * //   } ]
   * // } ]
   */
  async getExperiments() {
    return getExperimentsInternal();
  },

  /**
   * Retrieves split experiments assignments as a base64-encoded bitmap.
   * @link https://eyeo.atlassian.net/browse/DATA-2793
   *
   * @function
   * @returns {Promise<string>} The encoded bitmap of experiment assignments.
   * @example
   * await ewe.experiments.getEncodedExperiments();
   * // returns AQ==
   */
  getEncodedExperiments,

  /**
   * Emitted when experiment data has changed
   * @event
   * @type {EventDispatcher<Array<Experiment>>}
   */
  onChanged
};
