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

import experimentsAPI from "./experiments.js";
import accountAPI from "./account/index.js";

/**
 * API to interact with the EWE via messages
 */
const messageAPI = {
  account: {
    getProfile: accountAPI.getProfile,
    hasPremium: accountAPI.hasPremium,
    isTrial: accountAPI.isTrial,
    getPreferences: accountAPI.getPreferences,
    getTrialDaysLeft: accountAPI.getTrialDaysLeft
  },
  experiments: {
    getFlag: experimentsAPI.getFlag,
    getFlags: experimentsAPI.getFlags,
    getAssignments: experimentsAPI.getAssignments
  }
};

/**
 * Handles a message API call by invoking the specified method on the given API.
 * @param {string} apiName The API to call, e.g. "experiments"
 * @param {string} methodName The method to call on the API, e.g. "getFlag"
 * @param {any[]} params The parameters to pass to the method,
 *   defaults to an empty array
 * @returns {Promise<*>} The result of the API call,
 *   which can be a Promise or a direct value.
 * @throws {Error} If the API or method does not exist,
 *   or if params is not an array.
 */
export async function handleMessageAPICall(apiName, methodName, params = []) {
  if (!Object.hasOwn(messageAPI, apiName)) {
    throw new Error(`API "${apiName}" does not exist in EWE frontend API`);
  }

  const api = messageAPI[apiName];

  if (typeof api[methodName] !== "function") {
    throw new Error(`Method "${methodName}" does not exist on API "${apiName}"`);
  }

  const safeParams = params == null ? [] : params;

  if (!Array.isArray(safeParams)) {
    throw new Error(
      `"params" must be an array if defined (received ${typeof safeParams})`
    );
  }

  const result = api[methodName](...safeParams);

  return await result;
}
