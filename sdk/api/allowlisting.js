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

import browser from "./browser.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {parseURL} from "adblockpluscore/lib/url.js";
import {MILLIS_IN_HOUR, MILLIS_IN_MINUTE,
        MILLIS_IN_DAY} from "adblockpluscore/lib/time.js";
import {base64ToArrayBuffer} from "adblockpluscore/lib/rsa.js";

import {filterEngine} from "./core.js";
import {getFrameInfo} from "./frame-state.js";
import {default as filters} from "./filters.js";
import {EventDispatcher} from "./types.js";
import {isEdge} from "./info.js";
import {Prefs} from "./prefs.js";

// Allowlisting depends on comparing timestamps which may be generated on
// different clocks on different servers across the internet. One day everyone
// will have perfectly synchronized clocks. Today however, we need some
// tolerance for if the two clocks are out of sync. Based on
// https://learn.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/maximum-tolerance-for-computer-clock-synchronization,
// Microsoft seems to expect 5 min to be a reasonable tolerance for clock
// skewing in Windows systems. This is also in the same order of magnitude the
// hour window we have for the timstamp to be valid.
const CLOCK_SKEW_TOLERANCE = 5 * MILLIS_IN_MINUTE;

// Note that this is a default implementation, but it might be
// replaced using `setAllowlistingCallback`. Don't rely on this
// behaviour.
let allowlistingCallback = function(domain, options) {
  let metadata = null;
  if (options && options.expiresAt) {
    metadata = {expiresAt: options.expiresAt};
  }
  return filters.add([`@@||${domain}^$document`], metadata);
};
let dispatchUnauthorized = () => {};

let authorizedPublicKeys = [];
let publicKeysUpdated = Promise.resolve();

let algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: {name: "SHA-512"}
};

function getAllowData(domain, timestamp) {
  let str = `${domain},${timestamp}`;
  return (new TextEncoder()).encode(str);
}

async function verifySignature(data, signature, pubKey) {
  return crypto.subtle.verify(
    algorithm,
    pubKey,
    signature,
    data
  );
}

function verifyTimestamp(timestamp) {
  if (typeof timestamp != "number" || isNaN(timestamp)) {
    return false;
  }

  let now = Date.now();

  let inTheFuture = timestamp > now + CLOCK_SKEW_TOLERANCE;
  let tooOld = timestamp < now - MILLIS_IN_HOUR - CLOCK_SKEW_TOLERANCE;
  return !inTheFuture && !tooOld;
}

async function verifyAnySignatures(domain, timestamp, signature) {
  if (typeof signature != "string") {
    return false;
  }

  await publicKeysUpdated;

  let data = getAllowData(domain, timestamp);
  let abSignature = base64ToArrayBuffer(signature);
  for (let key of authorizedPublicKeys) {
    if (await verifySignature(data, abSignature, key)) {
      return true;
    }
  }
  return false;
}

function verifyOptions(options) {
  if (!options) {
    return true;
  }

  const keys = Object.keys(options);
  if (keys.length !== 1 || keys[0] !== "expiresAt") {
    return false;
  }

  if (!Number.isInteger(options.expiresAt)) {
    return false;
  }

  const now = Date.now();
  const minExpiresAt = now + MILLIS_IN_DAY - CLOCK_SKEW_TOLERANCE;
  const maxExpiresAt = now + 365 * MILLIS_IN_DAY + CLOCK_SKEW_TOLERANCE;
  if (options.expiresAt < minExpiresAt || options.expiresAt > maxExpiresAt) {
    return false;
  }

  return true;
}

async function succeedAllowlisting(domain, options) {
  await allowlistingCallback(domain, options);
  // EE-258: Edge adding dynamic DNR rules return promise earlier,
  // than it actually processes the rules. So we workaround it by
  // waiting for some time longer to let it actually finish the adding.
  if (browser.declarativeNetRequest && isEdge()) {
    const sleepIntervalMillis = Prefs.edge_one_click_allowlisting_delay;
    await new Promise(r => setTimeout(r, sleepIntervalMillis));
  }
  return true;
}

function failAllowlisting(error) {
  dispatchUnauthorized(error);
  return false;
}

export async function allowlistPage(
  tabId, frameId, timestamp, signature, options
) {
  let frame = getFrameInfo(tabId, frameId);
  if (!frame) {
    return failAllowlisting({
      reason: "invalid_frame",
      request: {domain: null, timestamp, signature}
    });
  }

  let domain = frame.hostname;
  let request = {domain, timestamp, signature};

  if (frameId != 0) {
    return failAllowlisting({
      reason: "invalid_frame",
      request
    });
  }

  let urlInfo = parseURL(frame.url);
  let alreadyAllowlistedDomain = filterEngine.defaultMatcher.isAllowlisted(
    `${urlInfo.protocol}//${domain}`,
    contentTypes.DOCUMENT,
    domain,
    frame.sitekey
  );
  if (alreadyAllowlistedDomain) {
    return failAllowlisting({
      reason: "already_allowlisted",
      request
    });
  }

  let validOptions = verifyOptions(options);
  if (!validOptions) {
    return failAllowlisting({
      reason: "invalid_options",
      request
    });
  }

  let validTimestamp = verifyTimestamp(timestamp);
  if (!validTimestamp) {
    return failAllowlisting({
      reason: "invalid_timestamp",
      request
    });
  }

  let validSignature = await verifyAnySignatures(domain, timestamp, signature);
  if (!validSignature) {
    return failAllowlisting({
      reason: "invalid_signature",
      request
    });
  }

  return await succeedAllowlisting(domain, options);
}

async function setAuthorizedKeys(keys) {
  let newAuthorizedPublicKeys = [];
  for (let key of keys) {
    let abKey = base64ToArrayBuffer(key);
    let importedKey = await crypto.subtle.importKey(
      "spki",
      abKey,
      algorithm,
      false,
      ["verify"]
    );
    newAuthorizedPublicKeys.push(importedKey);
  }
  authorizedPublicKeys = newAuthorizedPublicKeys;
}

export default {
  /**
   * Updates the list of public keys used to verify allowlisting
   * requests. If there are any invalid keys, the list of authorized
   * keys keeps its previous value.
   *
   * Any allowlisting requests that come in while this function is in
   * progress will wait for it to finish before verifying any
   * signatures.
   *
   * @param {[string]} keys The new set of public keys. The keys
   *   should be base64 encoded strings, in SPKI format. The keys must
   *   additionally use the RSASSA-PKCS1-v1_5 algorithm, SHA512 hash
   *   and 4096 bit long modulus.
   * @return {Promise} Promise that resolves when the keys have been
   *   updated, or rejects if any of the keys are invalid.
   */
  async setAuthorizedKeys(keys) {
    let resultPromise = setAuthorizedKeys(keys);
    publicKeysUpdated = resultPromise.catch(() => {});
    return await resultPromise;
  },

  /**
   * @callback allowlistingCallback
   * @param {string} domain The domain to allowlist.
   * @param {?Object} options Additional options for the allowlisting.
   * @param {Number} [options.expiresAt] The timestamp when the filter should
   *  expire (allowed 1 day - 365 days in the future).
   */

  /**
   * Set the function called when allowlisting succeeds.
   *
   * If the callback is not set, it has a default implementation that
   * adds an allowlisting filter for the allowlisted domain.
   *
   * @param {allowlistingCallback} callback The user defined function
   *   that will be called. This function should return a promise that
   *   resolves after adding the appropriate allowlisting filters.
   */
  setAllowlistingCallback(callback) {
    allowlistingCallback = callback;
  },

  /**
   * @typedef {Object} AllowlistingAuthorizationError
   * @property {string} reason The reason a request to allowlist was
   *   rejected. Can be "invalid_frame", "already_allowlisted",
   *   "invalid_timestamp", "invalid_signature" or "invalid_options".
   * @property {Object} request The rejected request.
   * @property {string} [request.domain] The domain of the page that
   *   the request came from. This is also the domain that the request
   *   would have allowlisted if it was valid. If this is null, it
   *   means that the frame's domain could not be determined.
   * @property {*} request.timestamp The timestamp in the
   *   request. For a valid request this is a number, but the request
   *   may have been invalid so it might not be a number.
   * @property {*} request.signature The signature in the
   *   request. For a valid request, this is string, but the request
   *   may have been invalid so it might not be a string.
   */

  /**
   * Emitted when an allowlisting request is rejected.
   * @event
   * @type {EventDispatcher<AllowlistingAuthorizationError>}
   */
  onUnauthorized: new EventDispatcher(
    dispatch => {
      dispatchUnauthorized = dispatch;
    },
    () => {
      dispatchUnauthorized = () => {};
    }
  )
};
