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

import {default as events} from "./events.js";
import {AccountService} from "./account-service.js";
import {
  hasPremium,
  getProfile,
  getProfileSync,
  isLoggedIn,
  clearUserData,
  clearStorage
} from "./storage.js";
import {MILLIS_IN_DAY, MILLIS_IN_HOUR} from "../../../adblockpluscore/lib/time.js";

let accountService;

/**
 * Starts the account management by adding a listener for authentication and
 * schedules a task to periodically check the account status.
 *
 * @param {Object} config - The config for the account service.
 * @param {string} config.apiBaseUrl - The endpoint for
 *   account-related resources.
 * @param {string} config.loginRequestPattern - The pattern for the login
 *  request URL. This is used to filter the login requests that will be
 *  intercepted.
 * @param {string} config.applicationId - The application identifier used to
 *   identify the application in the account system.
 * @returns {Promise<void>}
 * @ignore
 */
export async function start({
  apiBaseUrl,
  applicationId,
  loginRequestPattern,
  profileSyncConfig = {
    syncInterval: MILLIS_IN_DAY,
    errorRetryDelay: MILLIS_IN_HOUR,
    disableAutosync: false
  }
}) {
  // If the account service is already initialized, do nothing.
  if (accountService) {
    return;
  }

  // do not continue if the API base URL or application ID is not provided
  if (!apiBaseUrl || !applicationId) {
    return;
  }

  accountService = new AccountService({
    apiBaseUrl,
    loginRequestPattern,
    applicationId,
    profileSyncConfig
  });

  // Register the event listener for OTP login requests,
  // which will authenticate the user in the extension.
  accountService.startLoginListener();

  // Start the profile sync scheduler to periodically check the user's
  // profile and license status. Only start the scheduler if the user
  // is logged in.
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await accountService.startProfileSyncScheduler();
  }
}

/**
 * Stops the account management by clearing the account service instance
 * and stopping the profile sync scheduler and login listener.
 *
 * @ignore
 */
export async function stop() {
  if (!accountService) {
    return;
  }

  accountService.stopProfileSyncScheduler();
  accountService.stopLoginListener();
  accountService = null;
}

/**
 * Clears the all data from the account storage.
 * @returns {Promise<void>}
 *
 * @ignore
 */
export async function clearAccountStorage() {
  await clearStorage();
}

/**
 * API to interact with the user account
 * @namespace account
 */
export default {
  /**
   * Represents the user profile information.
   *
   * https://api.ua-qa.eyeo.it/docs/v1/#/paths/profile/get
   *
   * @typedef {Object} UserProfile
   * @property {string} email - The user's email address.
   * @property {string?} displayName - The user's display name, if available.
   * @property {Array<String>} features - The features available to the user
   *   (e.g., "premium", "adblocker").
   * @property {boolean} hasPremium - Indicates if the user has a
   *   premium account.
   */

  /**
   * Represents the profile sync status information.
   *
   * @typedef {Object} ProfileSyncStatus
   * @property {string?} lastSuccessfulRequest - Date for the last successful
   *   sync request.
   * @property {string?} lastRequestError - Date for the last sync
   *   request failed.
   */

  /**
   * Retrieves the user's profile information.
   *
   * @function
   * @memberof account
   * @returns {Promise<{UserProfile}>}
   */
  getProfile,

  /**
   * Checks if the user has an active premium subscription.
   *
   * @function
   * @memberof account
   * @returns {Promise<boolean>} True if the user has a premium subscription,
   *   false otherwise.
   */
  hasPremium,

  /**
   * Checks if the user is logged in.
   *
   * @function
   * @memberof account
   * @returns {Promise<boolean>} True if the user is logged in, false otherwise.
   */
  isLoggedIn,

  /**
   * Logs in the user using a license ID. This is intended for license-based
   * authentication during the migration from legacy accounts to the new
   * account system.
   *
   * @function
   * @deprecated
   * @memberof account
   * @param {Object} params - The options for logging in.
   * @param {string} params.userId - Uniquely identifies the installation.
   *     This is used to associate the client with the license.
   * @param {string} params.licenseId - The legacy license ID.
   *
   * @returns {Promise<void>}
   */
  async logInWithLicense({userId, licenseId}) {
    if (!accountService) {
      throw new Error("Account service is not initialized. Call EWE.account.start() first.");
    }

    await accountService.licenseLogIn({
      userId,
      licenseId
    });
  },

  /**
   * Logs out the user by clearing the account storage and stopping
   * the profile sync scheduler if it is running.
   *
   * @memberof account
   * @returns {Promise<void>}
   */
  async logOut() {
    if (accountService) {
      accountService.stopProfileSyncScheduler();
    }

    await clearUserData();
  },

  /**
   * Emitted when the user profile has changed
   *
   * @event
   * @memberof account
   * @type {EventDispatcher<{user: UserProfile, oldUser: UserProfile}>}
   */
  onChanged: events.dispatchEvent(events.EVENT_TYPES.ON_CHANGED),

  /**
   * Retrieves the status of the latest user profile synchronization
   *
   * @function
   * @memberof account
   * @returns {Promise<ProfileSyncStatus>}
   */
  getProfileSyncStatus: getProfileSync
};
