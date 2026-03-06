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
import {hasAcceptableAdsEnabled} from "../subscriptions.js";
import * as info from "../info.js";
import initializer from "../initializer.js";
import {getTrialDaysLeft, getPreferences} from "../account/storage.js";

const UNKNOWN_COUNTRY_CODE = "unknown";
let _getFacts = async() => ({});
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
 * Retrieves in-product messaging commands
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

  if (!Array.isArray(rawData.ipmCommands)) {
    return [];
  }

  return rawData.ipmCommands;
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
  const [aaEnabled, trialDaysLeft, preferences] = await Promise.all([
    hasAcceptableAdsEnabled(),
    getTrialDaysLeft(),
    getPreferences()
  ]);

  return {
    extName,
    extVersion: info.addonVersion,
    browserName: info.application,
    browserLanguage: browser.i18n.getUILanguage(),
    aaEnabled,
    installType,
    isTrial: trialDaysLeft > 0,
    trialDaysLeft,
    marketingConsent: !!preferences.marketingEmail
  };
}

/**
 * Get all facts for condition evaluation: country code,
 * default facts, and host-provided facts combined.
 *
 * @typedef {Object} Facts
 * @property {string} extName - The extension name.
 * @property {string} extVersion - The extension version (semver).
 * @property {string} countryCode - The 2-letter country code of the user.
 * @property {string} browserName - The browser name.
 * @property {string} browserLanguage - The UI language.
 * @property {boolean} aaEnabled - Whether Acceptable Ads is enabled.
 * @property {management.ExtensionInstallType} installType - The installation
 *    type of the extension e.g. "normal", "sideload", "development", etc.
 * @property {boolean} isTrial - Whether the user is on a trial.
 * @property {number} trialDaysLeft - Days left in trial.
 * @property {boolean} marketingConsent - Whether the user consented to
 *    marketing emails.
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
