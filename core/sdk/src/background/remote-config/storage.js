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
import {PersistentState} from "../persistence.js";
import {hasAcceptableAdsEnabled, getSubscriptions} from "../subscriptions.js";
import * as info from "../info.js";
import initializer from "../initializer.js";
import {getTrialDaysLeft, getPreferences} from "../account/storage.js";
import experiments from "../experiments.js";
import * as clientIds from "../client-ids.js";
import {sha256Prefix} from "../../all/hashing.js";
import sentry from "../sentry.js";
import {toTrackedFilterListUrl, isActiveFilterList}
  from "./filter-list-urls.js";

const UNKNOWN_COUNTRY_CODE = "unknown";
let _getFacts = async() => ({});
let _rulesIndex = null;
export const remoteConfigState = new PersistentState("ewe:remote_config", browser.storage.local);

/**
 * Retrieves the remote config data
 * @returns {Promise<Object|null>}
 */
export async function getConfig() {
  const state = await remoteConfigState.getStateLoaded();
  return state.rawData;
}

/**
 * Retrieves experiments config
 * @returns {Promise<Experiment[]>}
 */
export async function getExperimentsConfig() {
  const state = await remoteConfigState.getStateLoaded();
  const rawData = state.rawData;

  if (!rawData || !Array.isArray(rawData.experiments)) {
    return [];
  }

  return rawData.experiments;
}

/**
 * Retrieves cohorts config
 * @returns {Promise<Object[]>}
 */
export async function getCohortsConfig() {
  const state = await remoteConfigState.getStateLoaded();
  const rawData = state.rawData;

  if (!rawData || !Array.isArray(rawData.cohorts)) {
    return [];
  }

  return rawData.cohorts;
}

/**
 * Collects `ipmCommands` carried by the experiment variants the current
 * client is assigned to.
 *
 * @param {Object[]} experimentsConfig - The remote config raw experiments
 *   array
 * @returns {Promise<Object[]>}
 */
async function getIpmCommandsFromAssignedVariants(experimentsConfig) {
  const assignments = await experiments.getAssignments();
  const commands = [];

  for (const experiment of experimentsConfig) {
    const assignedVariantId = assignments[experiment.experimentId];
    if (!assignedVariantId || !Array.isArray(experiment.variants)) {
      continue;
    }
    const assignedVariant = experiment.variants.find(
      variant => variant.variantId === assignedVariantId
    );
    if (assignedVariant && Array.isArray(assignedVariant.ipmCommands)) {
      commands.push(...assignedVariant.ipmCommands);
    }
  }

  return commands;
}

/**
 * Retrieves in-product messaging commands.
 *
 * Returns the concatenation of:
 *   - `ipmCommands` carried by experiment variants the current client is
 *     assigned to (if any), and
 *   - the top-level `ipmCommands` from the remote config (if any).
 *
 * The variant-scoped commands let an experiment variant deliver its own
 * IPM payload (on-page-dialog, new-tab) to A/B-test entire campaigns.
 * `ipm_id` uniqueness across the two sources is guaranteed by the config
 * side, so no duplicate-resolution logic is performed here.
 *
 * @returns {Promise<Object[]|null>}
 */
export async function getIpmCommands() {
  const state = await remoteConfigState.getStateLoaded();
  const rawData = state.rawData;

  // It does matter whether we don't have any data, or whether the are no
  // commands, because we are using the absence of an IPM command to determine
  // whether or not it should be considered active
  if (!rawData) {
    return null;
  }

  const commands = [];

  if (Array.isArray(rawData.experiments)) {
    commands.push(
      ...await getIpmCommandsFromAssignedVariants(rawData.experiments)
    );
  }

  if (Array.isArray(rawData.ipmCommands)) {
    commands.push(...rawData.ipmCommands);
  }

  return commands;
}

/**
 * Retrieves logging config
 * @returns {Promise<Object>}
 */
export async function getLoggingConfig() {
  const state = await remoteConfigState.getStateLoaded();
  const rawData = state.rawData;

  if (!rawData || typeof rawData.loggingLevels !== "object") {
    return {};
  }

  return rawData.loggingLevels;
}

/**
 * Retrieves the 2-letter country code from the remote config response.
 *    e.g. "US", "DE", etc.
 * @returns {Promise<string>}
 */
export async function getCountryCode() {
  const state = await remoteConfigState.getStateLoaded();
  return state.countryCode || UNKNOWN_COUNTRY_CODE;
}

/**
 * Retrieves the 32-letter client ID from the remote config response.
 *    e.g. "BD386D23DCBC2A7C92E37AEBA50D32FE".
 * @returns {Promise<string>}
 */
export async function getClientId() {
  const state = await remoteConfigState.getStateLoaded();
  return state.clientId || null;
}

/**
 * Retrieves current remote config revision ID
 * @returns {Promise<string|null>}
 */
export async function getRevisionId() {
  const state = await remoteConfigState.getStateLoaded();
  return state.revisionId || null;
}

/**
 * Retrieves the status of the latest remote config synchronization
 * @returns {Promise<RemoteConfigSyncStatus>}
 */
export async function getSyncStatus() {
  const state = await remoteConfigState.getStateLoaded();

  return {
    errors: state.errors || [],
    lastDownloaded: state.lastDownloaded,
    lastNetworkError: state.lastNetworkError
  };
}

/**
 * Set the function to get host-provided facts for condition evaluation.
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
 * Set the host-specific rules index for static rule count computation.
 *
 * @param {Array} rulesIndex
 * @ignore
 */
export function setRulesIndex(rulesIndex) {
  _rulesIndex = rulesIndex;
}

/**
 * Computes the total static rule count for enabled subscriptions.
 *
 * @param {Array} subscriptions
 * @param {Array} rulesIndex
 * @returns {number}
 */
function computeStaticRuleCount(subscriptions, rulesIndex) {
  const ruleCountByUrl = new Map(
    rulesIndex.map(entry => [
      entry.url,
      entry.rule_count != null ? entry.rule_count : 0
    ])
  );
  return subscriptions
    .filter(sub => sub.enabled)
    .reduce((sum, sub) => sum + (ruleCountByUrl.get(sub.url) || 0), 0);
}

/**
 * Get the default facts for condition evaluation. These are
 * facts derived from the extension's own state.
 *
 * @returns {Promise<Facts>}
 */
async function getDefaultFacts() {
  await initializer.start();
  const {installType} = await browser.management.getSelf();
  let {short_name: extName} = browser.runtime.getManifest();
  extName = extName ? extName.replace(/ /g, "").toLowerCase() : extName;
  const isMV3 = !!browser.declarativeNetRequest;
  const allSubscriptions = getSubscriptions();
  const activeFilterUrls = allSubscriptions
    .filter(isActiveFilterList)
    .map(s => s.url);
  const normalizedFilterUrls = [
    ...new Set(activeFilterUrls.flatMap(toTrackedFilterListUrl))
  ];
  const [
    aaEnabled, trialDaysLeft, preferences, dynamicRules,
    filterLists, clientIdStability, clientIdRotationFrequency
  ] = await Promise.all([
    hasAcceptableAdsEnabled(),
    getTrialDaysLeft(),
    getPreferences(),
    isMV3 ?
      browser.declarativeNetRequest.getDynamicRules() : Promise.resolve([]),
    Promise.all(normalizedFilterUrls.slice(0, 10).map(sha256Prefix))
      .then(h => h.sort()),
    clientIds.getClientIdStability(),
    clientIds.getClientIdRotationFrequency()
  ]);

  let pingIdMintCount;
  let eventsIdMintCount;
  if (await experiments.getFlag("report-sync-ids-mint-count")) {
    try {
      ({pingIdMintCount, eventsIdMintCount} =
        await browser.storage.sync.get(
          {pingIdMintCount: 0, eventsIdMintCount: 0}
        ));
    }
    catch(e) {
      e.message = `storage.sync: ${e.message}`;
      sentry.reportError(e);
    }
  }

  let staticRuleCount;
  if (_rulesIndex) {
    staticRuleCount = isMV3
      ? computeStaticRuleCount(allSubscriptions, _rulesIndex)
      : 0;
  }

  return {
    extName,
    extVersion: info.addonVersion,
    browserName: info.application,
    browserVersion: info.applicationVersion,
    browserLanguage: browser.i18n.getUILanguage(),
    aaEnabled,
    installType,
    isTrial: trialDaysLeft > 0,
    trialDaysLeft,
    marketingConsent: !!preferences.marketingEmail,
    dynamicRuleCount: dynamicRules.length,
    filterLists,
    staticRuleCount,
    pingIdMintCount,
    eventsIdMintCount,
    clientIdStability,
    clientIdRotationFrequency
  };
}

/**
 * Get all facts for condition evaluation: country code,
 * default facts, and host-provided facts combined.
 *
 * @typedef {Object} Facts
 * @property {string} extName - The extension name.
 * @property {string} extVersion - The extension version (semver).
 * @property {number} installDate - The timestamp when the extension was
 *    installed, in milliseconds since the epoch.
 * @property {string} countryCode - The 2-letter country code of the user.
 * @property {string} browserName - The browser name.
 * @property {string} browserVersion - The browser version.
 * @property {string} browserLanguage - The UI language.
 * @property {boolean} aaEnabled - Whether Acceptable Ads is enabled.
 * @property {boolean} hasPremium - Whether the user has a premium license.
 * @property {management.ExtensionInstallType} installType - The installation
 *    type of the extension e.g. "normal", "sideload", "development", etc.
 * @property {boolean} isTrial - Whether the user is on a trial.
 * @property {number} trialDaysLeft - Days left in trial.
 * @property {number} reverseTrialStartDate - The timestamp when the user
 *    started the reverse trial for zero delay snippets, in milliseconds
 *    since the epoch.
 * @property {boolean} marketingConsent - Whether the user consented to
 *    marketing emails.
 * @property {number} blockedCount - The number of ads blocked by the extension.
 * @property {number} customFiltersCount - The number of active custom
 *    (user-added) filters.
 * @property {number} dynamicRuleCount - The number of active dynamic
 *    declarative net request rules (MV3 only).
 * @property {number} staticRuleCount - The number of enabled static
 *    declarative net request rulesets (MV3 only).
 * @property {string[]} filterLists - 12-character SHA-256 hash prefixes of
 *    active filter list subscription URLs. Filtered to only easylist,
 *    acceptable ads, privacy friendly acceptable ads, anti-cv, easyprivacy, and
 *    premium. Language lists that include easylist report as easylist. Maximum
 *    length of 10.
 * @property {number} lastBlockthroughTagDate - The timestamp when the
 *    blockthrough tag was last seen, in milliseconds since the epoch.
 * @property {number} lastBaitBlockedDate - The timestamp when a bait request
 *    was last blocked, in milliseconds since the epoch.
 * @property {boolean} partnerExtensionCoinstalled - Whether an ABP or AB
 *    co-install has been detected.
 * @property {number} clientIdStability - Frequency of the most common
 *    client ID (IP address hash) in the client ID history, as a
 *    percentage of all entries. 0 if there isn't enough history yet.
 * @property {number} clientIdRotationFrequency - How often the client ID
 *    (IP address hash) rotates, in days (e.g. 1 for daily, 7 for weekly).
 *    0 if there isn't enough history yet, or no rotation was observed.
 *
 * @returns {Promise<Facts>}
 */
export async function getAllFacts() {
  const [countryCode, defaultFacts, hostFacts] = await Promise.all([
    getCountryCode(),
    getDefaultFacts(),
    _getFacts()
  ]);
  return {
    countryCode,
    ...defaultFacts,
    ...hostFacts
  };
}
