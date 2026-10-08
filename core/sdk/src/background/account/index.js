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
  getLastTokenUpdate,
  isLoggedIn,
  clearUserData,
  clearStorage,
  isTrial,
  getPreferences,
  getTrialDaysLeft
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
 * @param {string} config.applicationId - The application identifier used to
 *   identify the application in the account system.
 * @param {string} config.loginRequestPattern - The pattern for the login
 *  request URL. This is used to filter the login requests that will be
 *  intercepted.
 * @param {Object} [config.profileSyncConfig] - Configuration for profile
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

  // Stop, if the API base URL, portal URL or application ID is not provided
  if (!apiBaseUrl || !loginRequestPattern || !applicationId) {
    // eslint-disable-next-line no-console
    console.debug("Skipping account service initialization");
    return;
  }

  accountService = new AccountService({
    apiBaseUrl,
    applicationId,
    loginRequestPattern,
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
   * User subscription information
   * @typedef {Object} UserSubscription
   * @property {boolean} [isTrial] - Whether the user is currently on a trial
   * @property {number} [trialDaysLeft] - Number of days remaining in the
   *   trial period
   * @property {string} [trialEndDate] - ISO 8601 timestamp when the trial
   *   period ends
   */

  /**
   * User preferences and consent settings
   * @typedef {Object} UserPreferences
   * @property {boolean} [marketingEmail] - Whether the user has consented to
   *   marketing emails
   */

  /**
   * Represents the user profile information.
   *
   * https://api.ua-qa.eyeo.it/docs/v1/#/paths/profile/get
   *
   * @typedef {Object} UserProfile
   * @property {string} email - The user's email address.
   * @property {string?} displayName - The user's display name, if available.
   * @property {boolean} hasPremium - Indicates if the user has a
   *   premium account.
   * @property {Array<String>} features - The features available to the user
   *   (e.g., "premium", "adblocker").
   * @property {UserSubscription} [subscription] - User subscription information
   *   including trial status
   * @property {UserPreferences} [preferences] - User preferences and consent
   *   settings
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
   * Retrieves the user's trial status.
   *
   * @function
   * @memberof account
   * @returns {Promise<boolean>} True if the user is on trial, false otherwise.
   */
  isTrial,

  /**
   * Retrieves the user's preferences.
   *
   * @function
   * @memberof account
   * @returns {Promise<Record<string, boolean>>} An object containing user
   *   preferences.
   */
  getPreferences,

  /**
   * Retrieves the user's trial days left.
   *
   * @function
   * @memberof account
   * @returns {Promise<number>} Number of trial days remaining (defaults to 0
   *   if not on trial).
   */
  getTrialDaysLeft,

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
  getProfileSyncStatus: getProfileSync,

  /**
   * Retrieves the time the access and refresh tokens were last saved, which
   * happens on a successful login or token refresh. The value is kept after
   * logging out.
   *
   * @function
   * @memberof account
   * @returns {Promise<number|null>} Milliseconds since the Unix epoch, or
   *   null if tokens were never saved.
   */
  getLastTokenUpdate
};
