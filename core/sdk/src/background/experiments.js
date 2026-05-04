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
import {Engine} from "json-rules-engine";
import {JSONPath} from "jsonpath-plus";

import {EventEmitter} from "#adblockpluscore/lib/events.js";
import {PersistentState} from "./persistence.js";
import {EventDispatcher} from "./types.js";
import sentry from "./sentry.js";
import {debug, warn} from "./debugging.js";
import {base64Encode} from "./set-operations.js";
import {modHashString} from "../all/hashing.js";
import {getExperimentsConfig, getAllFacts} from "./remote-config/storage.js";
import * as operators from "./cohorts/operators.js";

let emitter = new EventEmitter();
let experimentData = new PersistentState("ewe:split_experiments", browser.storage.local);

// Restore Sentry feature flags from persistent storage on service worker
// startup. This ensures that experiment flags are available in Sentry error
// reports even after the service worker restarts, until the next remote
// config sync occurs.
experimentData.load(savedState => {
  try {
    if (savedState && savedState.flags) {
      sentry.setFeatureFlags(savedState.flags);
    }
  }
  catch (e) {
    warn(`Error while setting Sentry feature flags: ${e.message}`);
    sentry.reportError(e);
  }
});

let onChanged = new EventDispatcher(dispatch => {
  emitter.on("updated", async() => {
    dispatch(await getExperimentsInternal());
  });
});

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

/**
 * Checks whether all facts and operators used in the conditions are
 * supported by this version of the extension. This prevents older
 * extensions from breaking when the server config introduces new
 * facts or operators.
 *
 * @param {Object} conditions - The conditions object (with all/any/not).
 * @param {Facts} facts - The current facts.
 * @param {Engine} engine - The rules engine (to check registered operators).
 * @returns {boolean} true if all facts and operators are supported.
 */
function areConditionsSupported(conditions, facts, engine) {
  const factsUsed = JSONPath({path: "$..fact", json: conditions});
  const operatorsUsed = JSONPath({path: "$..operator", json: conditions});

  const allFactsSupported = factsUsed.every(factName =>
    typeof facts[factName] !== "undefined");
  const allOperatorsSupported = operatorsUsed.every(opName =>
    engine.operators.get(opName) !== null);

  return allFactsSupported && allOperatorsSupported;
}

async function assignVariants(experiments, facts) {
  const seed = await getSeed();
  const flags = {};
  const assignments = {};

  // Split experiments into unconditional and conditional
  const unconditional = [];
  const conditional = [];

  for (const experiment of experiments) {
    if (experiment.enabled === false) {
      continue;
    }
    if (experiment.conditions) {
      conditional.push(experiment);
    }
    else {
      unconditional.push(experiment);
    }
  }

  // Evaluate conditions using a single engine (if needed)
  const matchedExperimentIds = new Set();
  if (conditional.length > 0) {
    const engine = new Engine([], {allowUndefinedFacts: true});

    for (const [name, fn] of Object.entries(operators)) {
      engine.addOperator(name, fn);
    }

    for (const experiment of conditional) {
      if (!areConditionsSupported(
        experiment.conditions, facts, engine
      )) {
        warn("[experiments] Skipping experiment " +
          `'${experiment.experimentId}' due to ` +
          "unsupported fact(s) or operator(s)");
        continue;
      }

      engine.addRule({
        conditions: experiment.conditions,
        event: {type: experiment.experimentId}
      });
    }

    const result = await engine.run(facts);
    for (const event of result.events) {
      matchedExperimentIds.add(event.type);
    }
  }

  // Assign variants for unconditional +
  // conditional experiments that matched
  const toAssign = [
    ...unconditional,
    ...conditional.filter(
      e => matchedExperimentIds.has(e.experimentId)
    )
  ];

  for (const experiment of toAssign) {
    const mod = await modHashString(
      `${seed}:${experiment.experimentId}`
    );

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

  const config = await getExperimentsConfig();
  const experiments = config.map(experiment => {
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

  const config = await getExperimentsConfig();
  const bitArray = config.flatMap(experiment =>
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
  experimentData.clearState();
  await experimentData.save();
}

/**
 * Assigns the current client to the variants of the experiments
 *
 * @ignore
 * @returns {Promise<void>}
 */
export async function sync() {
  try {
    const config = await getExperimentsConfig();
    const state = await experimentData.getStateLoaded();
    const facts = await getAllFacts();
    const {flags, assignments} = await assignVariants(config, facts);

    const flagsChanged = JSON.stringify(flags) !==
      JSON.stringify(state.flags);
    const assignmentsChanged = JSON.stringify(assignments) !==
      JSON.stringify(state.assignments);

    // If neither flags nor assignments have changed, we can skip saving and
    // emitting the update event. This is an optimization to avoid unnecessary
    // work when things haven't changed.
    if (!flagsChanged && !assignmentsChanged) {
      debug("[experiments] No changes in experiment assignments or flags");
      return;
    }

    state.flags = flags;
    state.assignments = assignments;
    await experimentData.save();

    emitter.emit("updated");
    sentry.setFeatureFlags(flags);
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
   * Clears a single feature flag override, restoring it to the
   * remote-configured value.
   * Unlike clearFlagOverrides() which removes all overrides, this
   * targets a specific flag.
   *
   * @param {string} flagId - Identifier of the feature flag override to clear
   * @returns {Promise<void>}
   */
  async clearFlagOverride(flagId) {
    const state = await experimentData.getStateLoaded();

    if (!state.overrides || !(flagId in state.overrides)) {
      return;
    }

    delete state.overrides[flagId];
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
