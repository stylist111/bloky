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
import * as accountStorage from "./storage.js";
import {ClientError, RateLimitError, UnauthorizedError} from "./errors.js";
import {MILLIS_IN_DAY, MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";
import {getNextRequestTimestamp, Scheduler} from "../../all/scheduler.js";
import {ACCOUNT_PATHS, HEADERS, PORTAL_NAME} from "./resources.js";
import {fetchWithRetry} from "./fetch-with-retry.js";

/**
 * Returns the resource URLs for the account management API.
 *
 * @param {string} apiBaseUrl - The base URL of the account management API.
 * @returns {Object}
 */
function getResourceUrls(apiBaseUrl) {
  return {
    PROFILE: `${apiBaseUrl}${ACCOUNT_PATHS.PROFILE}`,
    REFRESH_TOKENS: `${apiBaseUrl}${ACCOUNT_PATHS.REFRESH_TOKENS}`,
    LICENSE_LOGIN: `${apiBaseUrl}${ACCOUNT_PATHS.LICENSE_LOGIN}`
  };
}

/**
 * AccountService is responsible for managing authentication flows,
 * token refresh, profile syncing, and login events using the configured
 * account system.
 *
 * It encapsulates the logic for resource URL routing, token persistence,
 * and automatic retries on expired tokens.
 */
export class AccountService {
  /**
   * Initializes the AccountService with required configuration.
   *
   * @param {Object} params - Initialization parameters.
   * @param {string} params.apiBaseUrl - The base URL of the account API.
   * @param {string} params.applicationId - The application ID used for headers
   * @param {string} params.loginRequestPattern - The pattern for login requests
   *  (used for login listeners).
   * @param {Object} params.profileSyncConfig - The configuration for profile
   *  synchronization, including:
   *  - `syncInterval`: Interval in milliseconds for profile sync
   *      (default: 24 hours).
   *  - `errorRetryDelay`: Delay in milliseconds for retrying after an error
   *      (default: 1 hour).
   *  - `disableAutosync`: If true, disables automatic profile synchronization
   *      (default: false).
   */
  constructor({
    apiBaseUrl,
    applicationId,
    loginRequestPattern,
    profileSyncConfig = {
      syncInterval: MILLIS_IN_DAY,
      errorRetryDelay: MILLIS_IN_HOUR,
      disableAutosync: false
    }
  }) {
    this.apiBaseUrl = apiBaseUrl;
    this.applicationId = applicationId;
    this.profileSyncConfig = profileSyncConfig;
    this.loginRequestPattern = loginRequestPattern;

    this.scheduler = null;
    this.resources = getResourceUrls(apiBaseUrl);
  }

  /**
   * Syncs the user's profile by sending a request to the profile endpoint.
   * Automatically refreshes the token if the original request fails
   * with an UnauthorizedError.
   *
   * API documentation:
   * https://api.ua-qa.eyeo.it/docs/v1/#/paths/profile/get
   *
   * @returns {Promise<Response>} - The fetch response from the profile API.
   * @throws {
   * UnauthorizedError|ClientError|ServerError|NetworkError|MaxRetryError
   * }
   */
  async syncProfile() {
    const getProfile = async() => {
      const {accessToken} = await accountStorage.getTokens();

      if (!accessToken) {
        throw new Error("No access token available");
      }

      return fetchWithRetry({
        url: this.resources.PROFILE,
        options: {
          method: "GET",
          headers: {
            [HEADERS.X_APPLICATION_ID]: this.applicationId,
            [HEADERS.AUTHORIZATION]: `Bearer ${accessToken}`
          }
        }
      });
    };

    const profile = await this._callWithTokenRefresh({
      methodFn: getProfile
    });

    await accountStorage.saveProfile(profile);
  }

  /**
   * Internal method to perform a request with automatic retry if the
   * access token has expired.
   *
   * @private
   * @param {Object} params
   * @param {Function} params.methodFn - The API method to call.
   * @throws {
   *   UnauthorizedError|ClientError|ServerError|NetworkError|MaxRetryError
   * }
   * @returns {Promise<Object>}
   */
  async _callWithTokenRefresh({
    methodFn
  }) {
    try {
      return await methodFn();
    }
    catch (error) {
      if (error instanceof UnauthorizedError) {
        await this.refreshTokens();
        return await methodFn();
      }

      throw error;
    }
  }

  /**
   * Internal helper to refresh the access token using the stored refresh token.
   * Clears tokens if the refresh token is invalid.
   *
   * API documentation:
   * https://api.ua-qa.eyeo.it/docs/v1/#/paths/token-refresh/post
   *
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   * @throws {
   *   UnauthorizedError|ClientError|ServerError|NetworkError|MaxRetryError
   * }
   */
  async refreshTokens() {
    const {refreshToken} = await accountStorage.getTokens();

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const payload = {refreshToken};

      const tokens = await fetchWithRetry({
        url: this.resources.REFRESH_TOKENS,
        options: {
          method: "POST",
          headers: {
            [HEADERS.X_APPLICATION_ID]: this.applicationId
          },
          body: JSON.stringify(payload)
        }
      });

      await accountStorage.saveTokens(tokens);
    }
    catch (error) {
      // If it's a client error (4xx) but not a rate limit error (429),
      // we assume the refresh token is invalid and need to log out the user.
      if (error instanceof ClientError && !(error instanceof RateLimitError)) {
        // If the refresh token is invalid, we need to clear
        // any stored data for the user session.
        await accountStorage.clearUserData();
        sentry.reportError(error);
      }

      throw error;
    }
  }

  /**
   * Logs in the user using a license ID. This is intended for license-based
   * authentication during the migration from legacy accounts to the new
   * account system.
   *
   * API documentation:
   * https://api.ua-qa.eyeo.it/docs/v1/#/paths/migration-login-ab/post
   *
   * @param {Object} params
   * @param {string} params.userId - Uniquely identifies the installation.
   *    This is used to associate the client with the license.
   * @param {string} params.licenseId - The legacy license ID.
   * @returns {Promise<void>}
   * @throws {UnauthorizedError|ClientError|ServerError|NetworkError|
   * MaxRetryError}
   */
  async licenseLogIn({userId, licenseId}) {
    const payload = {
      clientId: `ext_${userId}`,
      licenseId
    };

    const tokens = await fetchWithRetry({
      url: this.resources.LICENSE_LOGIN,
      options: {
        method: "POST",
        headers: {
          [HEADERS.X_APPLICATION_ID]: this.applicationId
        },
        body: JSON.stringify(payload)
      }
    });

    await accountStorage.saveTokens(tokens);
    this.startProfileSyncScheduler();
  }

  /**
   * Handles the authentication listener for the login endpoint.
   * This method is triggered when a POST request is made to the login endpoint
   * and checks the response headers for access and refresh tokens.
   * It saves the tokens to the account storage and starts the profile
   * synchronization scheduler if the login is successful.
   *
   * @private
   * @param {string} method - The HTTP method of the request (e.g., POST).
   * @param {number} statusCode - The HTTP status code of the response.
   * @param {Object} responseHeaders - The headers of the response.
   * @returns {Promise<void>}
   */
  async _authListener({method, statusCode, responseHeaders}) {
    if (!method || method.toLowerCase() !== "post") {
      // e.g. do noting for OPTIONS
      return;
    }

    if (statusCode < 200 || statusCode >= 300) {
      // do nothing for non-200 responses
      return;
    }

    const getHeaderValue = (headers, headerName) => {
      const header = headers.find(h =>
        h.name.toLowerCase() === headerName.toLowerCase());
      return header ? header.value : null;
    };

    const portalName = getHeaderValue(
      responseHeaders,
      HEADERS.X_APPLICATION_NAME
    );

    if (portalName !== PORTAL_NAME) {
      // If the portal name does not match, we ignore the response.
      return;
    }

    const accessToken =
      getHeaderValue(responseHeaders, HEADERS.X_ACCESS_TOKEN);
    const refreshToken =
      getHeaderValue(responseHeaders, HEADERS.X_REFRESH_TOKEN);

    if (!accessToken || !refreshToken) {
      sentry.reportError(new Error("Login listener: Missing access or refresh token in response headers."));
      return;
    }

    await accountStorage.saveTokens({accessToken, refreshToken});

    // Restart the profile sync scheduler on every login. This will ensure it's
    // fetching the profile right after each login.
    this.stopProfileSyncScheduler();
    await accountStorage.clearProfileSync();
    this.startProfileSyncScheduler();
  }

  /**
   * Starts a listener for the login endpoint, used to extract tokens
   * from response headers (e.g., after an OTP login).
   */
  startLoginListener() {
    this._authListener = this._authListener.bind(this);
    this.stopLoginListener();
    browser.webRequest.onHeadersReceived.addListener(
      this._authListener,
      {
        urls: [
          this.loginRequestPattern
        ]
      },
      ["responseHeaders"]
    );
  }

  /**
   * Stops the login listener that was previously set up.
   */
  stopLoginListener() {
    browser.webRequest.onHeadersReceived.removeListener(this._authListener);
  }

  /**
   * Starts the profile synchronization scheduler if it is not already running.
   */
  startProfileSyncScheduler() {
    const {
      syncInterval,
      errorRetryDelay,
      disableAutosync
    } = this.profileSyncConfig;

    if (this.scheduler || disableAutosync) {
      return;
    }

    // initialize the scheduler to periodically check the account status
    this.scheduler = new Scheduler({
      interval: syncInterval,
      errorRetryDelay,
      listener: async() => {
        const date = new Date().toISOString();

        try {
          await this.syncProfile();
        }
        catch (error) {
          if (!(await accountStorage.isLoggedIn())) {
            // If the user is not logged in, we stop the scheduler.
            this.stopProfileSyncScheduler();
            // Remove the saved scheduler state
            await accountStorage.clearProfileSync();
            return null;
          }

          await accountStorage.updateProfileSync({lastRequestError: date});
          sentry.reportError(error);

          return null;
        }

        await accountStorage.updateProfileSync({lastSuccessfulRequest: date});
        return true;
      },
      async getNextTimestamp() {
        const {lastSuccessfulRequest, lastRequestError} =
          await accountStorage.getProfileSync();

        const {
          nextCheckTimestamp,
          lastRequestError: updatedLastRequestError
        } = getNextRequestTimestamp({
          lastSuccessfulRequest,
          lastRequestError,
          errorRetryDelay,
          syncInterval
        });

        if (updatedLastRequestError) {
          await accountStorage.updateProfileSync({
            lastRequestError: updatedLastRequestError
          });
        }

        return nextCheckTimestamp;
      }
    });
  }

  /**
   * Stops the profile sync scheduler if it is running.
   */
  stopProfileSyncScheduler() {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
    }
  }
}
