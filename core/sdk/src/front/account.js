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
import {ignoreNoConnectionError} from "../all/errors.js";

/**
 * Sends a message to the service worker to call the user account API.
 * @param {string} methodName the method to call on the account API
 * @param {any[]} params the parameters to pass to the method
 * @returns {Promise<*>} the result of the API call.
 */
async function callAPI(methodName, ...params) {
  return await ignoreNoConnectionError(
    browser.runtime.sendMessage({
      type: "ewe:api-call",
      apiName: "account",
      methodName,
      params
    })
  );
}

/**
 * API to interact with the user account module
 * @namespace account
 */
export default {
  /**
   * Retrieves the user's profile information.
   * @ignore
   * @returns {Promise<UserProfile|null>}
   */
  async getProfile() {
    return await callAPI("getProfile");
  },

  /**
   * Checks if the user has an active premium subscription.
   *
   * @returns {Promise<boolean>} - True if the user has a premium subscription,
   *   false otherwise.
   */
  async hasPremium() {
    return await callAPI("hasPremium");
  },

  /**
   * Retrieves the user's trial status.
   *
   * @returns {Promise<boolean>} True if the user is on trial, false otherwise.
   */
  async isTrial() {
    return await callAPI("isTrial");
  },

  /**
   * Retrieves the user's preferences.
   *
   * @returns {Promise<Record<string, boolean>>} An object containing user
   *   preferences.
   */
  async getPreferences() {
    return await callAPI("getPreferences");
  },

  /**
   * Retrieves the user's trial days left.
   *
   * @returns {Promise<{ab: number, abp: number}>} An object containing trial
   *   days left for each product.
   */
  async getTrialDaysLeft() {
    return await callAPI("getTrialDaysLeft");
  }
};
