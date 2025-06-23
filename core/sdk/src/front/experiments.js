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
 * Sends a message to the service worker to call the experiments API.
 * @param {string} methodName the method to call on the experiments API
 * @param {any[]} params the parameters to pass to the method
 * @returns {Promise<*>} the result of the API call.
 */
async function callAPI(methodName, ...params) {
  return await ignoreNoConnectionError(
    browser.runtime.sendMessage({
      type: "ewe:api-call",
      apiName: "experiments",
      methodName,
      params
    })
  );
}

/**
 * API to interact with the experiments module
 * @namespace experiments
 */
export default {
  /**
   * Retrieves the value of a feature flag
   * @ignore
   * @param {string} flagId - Identifier of the feature flag
   * @returns {Promise<*|null>} Value of the feature flag or null if not found
   */
  async getFlag(flagId) {
    return await callAPI("getFlag", flagId);
  },

  /**
   * Retrieves all the available experiment flags
   * @ignore
   * @returns {Promise<*|null>} Value of the feature flag or null if not found
   */
  async getFlags() {
    return await callAPI("getFlags");
  },

  /**
   * Retrieves all the experiment assignments
   * @ignore
   * @returns {Promise<Object.<string, string>>} Object specifying the assigned
   *   variant ID for each active assigned experiment ID
   */
  async getAssignments() {
    return await callAPI("getAssignments");
  }
};
