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
import {Engine} from "json-rules-engine";
import {JSONPath} from "jsonpath-plus";
import {EventEmitter} from "adblockpluscore/lib/events.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";
import {PersistentState} from "../persistence.js";
import {EventDispatcher} from "../types.js";
import {hasAcceptableAdsEnabled} from "../subscriptions.js";
import * as info from "../info.js";
import {debug, warn} from "../debugging.js";
import initializer from "../initializer.js";
import * as operators from "./operators.js";
import sentry from "../sentry.js";
import {ServerLogger} from "../telemetry/server-logger.js";
import {base64Encode} from "../set-operations.js";

let _cohortsConfig = [];
const emitter = new EventEmitter();
const cohortsData = new PersistentState("ewe:cohorts", browser.storage.local);
const logger = new ServerLogger("cohorts");

let _getFacts = async() => ({});

const onChanged = new EventDispatcher(dispatch => {
  emitter.on("updated", async() => {
    dispatch(await _getActiveCohortIds());
  });
});

/**
 * Set the function to get facts for the cohorts engine.
 *
 * @param {Function} getFacts - A function that returns a Promise resolving to
 *    an object containing facts.
 * @ignore
 */
export function setFactsGetter(getFacts) {
  if (typeof getFacts !== "function") {
    throw new TypeError("getFacts must be a function");
  }
  _getFacts = getFacts;
}

/**
 * Get the default facts for the cohorts engine. This will be combined with
 * the facts passed from the extension (via setFactsGetter).
 *
 * @typedef {Object} Facts
 * @property {string} extName - The name of the extension.
 * @property {string} extVersion - The version of the extension (semver).
 * @property {string} browserName - The name of the browser.
 * @property {string} countryCode - The 2-letter country code of the user.
 * @property {boolean} aaEnabled - Whether Acceptable Ads is enabled.
 * @property {management.ExtensionInstallType} installType - The installation
 *    type of the extension.
 *
 * @returns {Promise<Facts>}
 */
async function getDefaultFacts() {
  await initializer.start();
  const {installType} = await browser.management.getSelf();
  let {short_name: extName} = browser.runtime.getManifest();
  extName = extName ? extName.replace(/ /g, "").toLowerCase() : extName;

  return {
    extName,
    extVersion: info.addonVersion,
    browserName: info.application,
    browserLanguage: browser.i18n.getUILanguage(),
    aaEnabled: await hasAcceptableAdsEnabled(),
    installType
  };
}

/**
 * Sends a snapshot of the current facts to the event system. This will be used
 * for cohort estimation and debugging purposes.
 *
 * @param {Facts} facts - The facts to send.
 * @returns {void}
 */
async function sendFactsSnapshot(facts) {
  const state = await cohortsData.getStateLoaded();
  const lastFactsSnapshotTimestamp = state.lastFactsSnapshotTimestamp || 0;

  // check if 12h have passed since the last snapshot
  if (Date.now() - lastFactsSnapshotTimestamp < 12 * MILLIS_IN_HOUR) {
    debug("[cohorts] Skipping facts snapshot, less than 12h ago have passed");
    return;
  }

  // send a snapshot of facts for 1% to the event system and
  // update the last snapshot timestamp
  logger.info("facts_snapshot", facts);
  state.lastFactsSnapshotTimestamp = Date.now();
  await cohortsData.save();
}

/**
 * Updates the active cohorts if they have changed and
 * emits the "updated" event.
 *
 * @param {string[]} newCohortIds - The new cohort IDs to set as active.
 * @returns {Promise<void>}
 */
async function updateIfChanged(newCohortIds) {
  const state = await cohortsData.getStateLoaded();
  const oldCohortIds = state.activeCohortIds || [];
  const newCohortIdsSet = new Set(newCohortIds);

  const areEqual = oldCohortIds.length === newCohortIdsSet.size &&
    oldCohortIds.every(v => newCohortIdsSet.has(v));

  if (!areEqual) {
    state.activeCohortIds = [...newCohortIdsSet];
    await cohortsData.save();
    emitter.emit("updated");
  }
}

/**
 * Assigns the current client to the matching cohorts
 *
 * @param {Array<Object>} config - The cohort configuration.
 * @param {string} countryCode - The 2-letter country code of the user.
 *
 * @ignore
 * @returns {Promise<void>}
 */
export async function sync(config, countryCode) {
  _cohortsConfig = config;
  try {
    const state = await cohortsData.getStateLoaded();

    if (!_cohortsConfig.length) {
      // No cohorts config available, so no cohorts to assign
      debug("[cohorts] Empty cohorts config, removing all cohorts");
      await updateIfChanged([]);
      return;
    }

    // get the facts with the latest values
    const newFacts = {
      countryCode,
      ...(await getDefaultFacts()),
      ...(await _getFacts())
    };

    // No changes in facts, no need to re-evaluate cohorts
    if (JSON.stringify(newFacts) === JSON.stringify(state.facts)) {
      debug("[cohorts] No changes in facts, skipping cohort evaluation");
      // send the facts snapshot to the event system
      // no need to await here since we are not changing the state
      sendFactsSnapshot(newFacts);
      return;
    }

    // Update the state with the new facts
    state.facts = newFacts;

    // Initialize the cohorts engine with the filtered cohort conditions
    const engine = new Engine([], {
      // Bypass the error thrown when fact is not defined,
      // and set default value to undefined
      allowUndefinedFacts: true
    });

    // Adds custom operators to the engine for cohort conditions
    for (const [operatorName, operatorFn] of Object.entries(operators)) {
      engine.addOperator(operatorName, operatorFn);
    }

    // filter out cohorts that have missing facts or operators
    for (const cohort of _cohortsConfig) {
      const {conditions, event} = cohort;
      const factsUsed = JSONPath({path: "$..fact", json: conditions});
      const operatorsUsed = JSONPath({path: "$..operator", json: conditions});

      // Check if all facts and operators are supported
      const allFactsSupported = factsUsed.every(factName =>
        typeof state.facts[factName] !== "undefined");
      const allOperatorsSupported = operatorsUsed.every(opName =>
        engine.operators.get(opName) !== null);

      if (!allFactsSupported || !allOperatorsSupported) {
        warn(`[cohorts] Skipping cohort '${event.type}' due to unsupported fact(s) or operator(s)`);
        continue;
      }

      // Add the cohort to the engine if all conditions are met
      engine.addRule(cohort);
    }

    // run the cohorts engine with the facts
    const result = await engine.run(state.facts);

    // postprocess the events into cohort IDs
    const newCohortIds = result.events.map(event => event.type);
    await updateIfChanged(newCohortIds);
    // send the facts snapshot to the event system
    // no need to await here since we are not changing the state
    sendFactsSnapshot(newFacts);
  }
  catch (e) {
    warn(`Error while synchronizing cohorts: ${e.message}`);
    sentry.reportError(e);
  }
}

/**
 * @ignore
 */
export async function reset() {
  _cohortsConfig = [];
  cohortsData.clearState();
  await cohortsData.save();
}

/**
 * Get the IDs of all active cohorts
 * @returns {Promise<*|*[]>}
 * @private
 */
async function _getActiveCohortIds() {
  const state = await cohortsData.getStateLoaded();
  return state.activeCohortIds || [];
}

/**
 * Encodes the cohort assignments as a base64-encoded bitmap.
 * @link https://eyeo.atlassian.net/browse/EXT-979
 *
 * @returns {Promise<string>}
 * @private
 */
async function getEncodedCohorts() {
  const activeCohortIds = await _getActiveCohortIds();

  const cohorts = _cohortsConfig.map(cohort => {
    const cohortId = cohort.event.type;
    return activeCohortIds.includes(cohortId) ? 1 : 0;
  });

  return base64Encode(cohorts);
}

/**
 * API to interact with cohorts
 * @namespace cohorts
 */
export default {
  /**
   * Get all the cohort IDs that the user is in
   *
   * @memberof cohorts
   * @returns {Promise<string[]>}
   * @example
   * await ewe.cohorts.getAll();
   * // returns ["top20_free_9d", "tier_1_and_2"]
   */
  async getAll() {
    return _getActiveCohortIds();
  },

  /**
   * Return the assigned cohorts encoded as a base64-encoded bitmap.
   * @link https://eyeo.atlassian.net/browse/EXT-979
   *
   * @function
   * @memberof cohorts
   * @returns {Promise<string>}
   * @example
   * await ewe.cohorts.getEncodedCohorts();
   * // returns AQ==
   */
  getEncodedCohorts,

  /**
   * Check if the user is in a specific cohort.
   *
   * @memberof cohorts
   * @param {string} cohortId - The ID of the cohort to check.
   * @returns {Promise<boolean>}
   * @example
   * await ewe.cohorts.includes("top20_free_9d");
   * // returns true if the user is in the cohort, false otherwise
   */
  async includes(cohortId) {
    const activeCohortIds = await _getActiveCohortIds();
    return activeCohortIds.includes(cohortId);
  },

  /**
   * Manually triggers synchronization of cohorts
   *
   * @function
   * @memberof cohorts
   * @param {Array<Object>} config - Array of cohorts configuration
   * @param {string} countryCode - The 2-letter country code
   * @returns {Promise<void>}
   */
  sync,

  /**
   * Emitted when active cohort Ids have changed.
   *
   * @event
   * @memberof cohorts
   * @type {EventDispatcher<Array<string>>}
   */
  onChanged
};
