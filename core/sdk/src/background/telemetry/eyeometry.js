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

import {default as experiments} from "../experiments.js";
import {premiumStatusCallback} from "../callbacks.js";
import * as info from "../info.js";
import {hasAcceptableAdsEnabled} from "../subscriptions.js";

export async function getExtensionMetadata() {
  let platform;
  let platformVersion;

  if (navigator.userAgentData) {
    const platformInfo = await navigator.userAgentData.getHighEntropyValues([
      "platform",
      "platformVersion"
    ]);

    platform = platformInfo.platform;
    platformVersion = platformInfo.platformVersion;
  }
  else {
    const platformInfo = await browser.runtime.getPlatformInfo();
    platform = platformInfo.os;
  }

  const payload = {
    // The OS. Windows, Linux, etc.
    platform,

    // The version of the system OS.
    platform_version: platformVersion,

    // The browser. Chrome, Firefox, etc.
    application: info.application,

    // The version of the browser.
    application_version: info.applicationVersion,

    // The name of the extension using the Engine.
    extension_name: info.addonName,

    // The extension's version.
    extension_version: info.addonVersion,

    // Depends on having the acceptable ads subscription enabled.
    aa_active: await hasAcceptableAdsEnabled(),

    // The currently assigned split experiments
    experiments: await getExperimentsAssignments()
  };

  if (premiumStatusCallback) {
    const premiumStatus = await premiumStatusCallback();
    payload.premium_status = premiumStatus ? "premium" : "free";
  }

  return payload;
}

/**
 * Uses the fetch API to make a POST request to the specified endpoint.
 *
 * @param {string} url URL for the request.
 * @param {string} bearer Bearer token for use in Authentication header.
 * @param {Object} body Request body, will be serialized into JSON to send.
 * @return {Promise<Object>} Promise resolves with the object returned from the
 *   server. Rejects if the request fails, or the response has an error status.
 * @ignore
 */
export async function postWithBearerToken(url, bearer, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${bearer}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Telemetry server responded with error status ${response.status}.`
    );
  }

  return await response.json();
}

async function getExperimentsAssignments() {
  const assignments = await experiments.getAssignments();
  return Object.entries(assignments).map(assignment => {
    return {
      experiment_id: assignment[0],
      variant_id: assignment[1]
    };
  });
}
