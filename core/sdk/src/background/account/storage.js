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
import sentry from "../sentry.js";
import {default as events} from "./events.js";
import {PersistentState} from "../persistence.js";
import {FEATURES} from "./resources.js";

const accountData = new PersistentState("ewe:account", browser.storage.local);

/**
 * Saves the access and refresh tokens to the account storage.
 *
 * @param {Object} tokens - An object containing accessToken and refreshToken.
 * @param {string} tokens.accessToken - The access token for the user.
 * @param {string} tokens.refreshToken - The refresh token for the user.
 * @returns {Promise<void>}
 * @throws {TypeError} If accessToken or refreshToken is not a non-empty string.
 */
export async function saveTokens({accessToken, refreshToken}) {
  const isValidToken = value =>
    typeof value === "string" && value.trim().length > 0;


  if (!isValidToken(accessToken) || !isValidToken(refreshToken)) {
    const error = new TypeError(
      "Both accessToken and refreshToken must be non-empty strings."
    );

    sentry.reportError(error);

    throw error;
  }

  const state = await accountData.getStateLoaded();
  state.accessToken = accessToken;
  state.refreshToken = refreshToken;
  state.lastTokenUpdate = Date.now();

  return accountData.save();
}

/**
 * Retrieves the access and refresh tokens from the account storage.
 *
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
export async function getTokens() {
  const {accessToken, refreshToken} = await accountData.getStateLoaded();

  return {
    accessToken,
    refreshToken
  };
}

/**
 * Checks if the user has a premium account based on the features
 * @param {Array<string>} features - The features array from the user profile.
 * @returns {boolean} - Returns true if the user has a premium account,
 *   false otherwise.
 */
function hasPremiumFeature(features) {
  return features && features.includes(FEATURES.PREMIUM);
}

/**
 * Retrieves the user's premium status from the account storage.
 *
 * @returns {Promise<boolean>}
 */
export async function hasPremium() {
  const state = await accountData.getStateLoaded();
  const user = state.user || {};

  return !!user.hasPremium;
}

/**
 * Saves the user profile to the account storage.
 *
 * @param {Object} params - The parameters for saving the profile.
 * @param {Object} params.user - The user profile object to save.
 * @return {Promise<void>}
 */
export async function saveProfile({user: newUser}) {
  const state = await accountData.getStateLoaded();
  const user = state.user || null;

  // Ensure the new user object has the necessary properties
  newUser.hasPremium = hasPremiumFeature(newUser.features);

  // No change, skip save
  if (JSON.stringify(user) === JSON.stringify(newUser)) {
    return;
  }

  state.user = newUser;
  await accountData.save();

  // Emit profile updated event
  events.emit(events.EVENT_TYPES.ON_CHANGED, {
    oldUser: user,
    user: newUser
  });
}

/**
 * Retrieves the user profile from the account storage.
 * If no profile is found, returns null.
 *
 * @return {Promise<UserProfile|null>}
 */
export async function getProfile() {
  const state = await accountData.getStateLoaded();
  return state.user || null;
}

/**
 * Clears the account storage by removing all user data
 * It emits an event to notify that the user data has been logged out.
 *
 * @returns {Promise<void>}
 */
export async function clearUserData() {
  const state = await accountData.getStateLoaded();
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  state.profileSync = null;

  await accountData.save();
  events.emit(events.EVENT_TYPES.ON_CHANGED, {user: null});
}

/**
 * Clears the account storage by removing all data
 *
 * @returns {Promise<void>}
 */
export async function clearStorage() {
  accountData.clearState();
  await accountData.save();
}

/**
 * Retrieves the last downloaded and last request error timestamps from the
 * storage.
 *
 * @returns {Promise<ProfileSyncStatus>}
 */
export async function getProfileSync() {
  const state = await accountData.getStateLoaded();

  return state.profileSync || {};
}

/**
 * Checks if the user is logged in by verifying the presence of
 * access and refresh tokens in the account storage.
 *
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn() {
  const {accessToken, refreshToken} = await getTokens();
  return !!(accessToken && refreshToken);
}

/**
 * Updates the last successful request and last network error timestamps
 * in the account storage.
 *
 * @param {string|undefined} lastSuccessfulRequest - The timestamp of the last
 *   successful request.
 * @param {string|undefined} lastRequestError - The timestamp of the last
 *   request error, if any.
 * @returns {Promise<void>}
 */
export async function updateProfileSync({
  lastSuccessfulRequest,
  lastRequestError
} = {}) {
  const state = await accountData.getStateLoaded();
  const profileSync = state.profileSync || {};

  if (lastSuccessfulRequest) {
    delete profileSync.lastRequestError;
    profileSync.lastSuccessfulRequest = lastSuccessfulRequest;
  }

  if (lastRequestError) {
    profileSync.lastRequestError = lastRequestError;
  }

  state.profileSync = profileSync;
  return accountData.save();
}

/**
 * Clears the profile sync data from the account storage.
 *
 * @returns {Promise<void>}
 */
export async function clearProfileSync() {
  const state = await accountData.getStateLoaded();
  state.profileSync = null;
  return accountData.save();
}
