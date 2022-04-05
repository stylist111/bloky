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

import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {defaultMatcher as matcher} from "adblockpluscore/lib/matcher.js";
import {parseURL} from "adblockpluscore/lib/url.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

import {getFrameInfo} from "./frame-state.js";
import {default as filters} from "./filters.js";
import {EventDispatcher} from "./types.js";

// Note that this is a default implementation, but it might be
// replaced using `setAllowlistingCallback`. Don't rely on this
// behaviour.
let allowlistingCallback = function(domain) {
  return filters.add([`@@||${domain}^$document`]);
};
let dispatchUnauthorized = () => {};

let authorizedPublicKeys = [];

let algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: {name: "SHA-512"}
};

function base64ToArrayBuffer(str) {
  let decodedData = atob(str);
  return Uint8Array.from(decodedData, c => c.charCodeAt(0));
}

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
  if (typeof timestamp != "number" || isNaN(timestamp))
    return false;

  let msSinceSigning = Date.now() - timestamp;
  return msSinceSigning >= 0 && msSinceSigning < MILLIS_IN_HOUR;
}

async function verifyAnySignatures(domain, timestamp, signature) {
  if (typeof signature != "string")
    return false;

  let data = getAllowData(domain, timestamp);
  let abSignature = base64ToArrayBuffer(signature);
  for (let key of authorizedPublicKeys) {
    if (await verifySignature(data, abSignature, key))
      return true;
  }
  return false;
}

async function succeedAllowlisting(domain) {
  await allowlistingCallback(domain);
  return true;
}

function failAllowlisting(error) {
  dispatchUnauthorized(error);
  return false;
}

export async function allowlistPage(tabId, frameId, timestamp, signature) {
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
  let alreadyAllowlistedDomain = matcher.isAllowlisted(
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

  return await succeedAllowlisting(domain);
}

export default {
  /**
   * Updates the list of public keys used to verify allowlisting requests.
   *
   * @param {[string]} keys The new set of public keys. The keys
   *   should be base64 encoded strings, in SPKI format. The keys must
   *   additionally use the RSASSA-PKCS1-v1_5 algorithm, SHA512 hash
   *   and 4096 bit long modulus.
   * @return {Promise} Promise that resolves when the keys have been
   * updated, or rejects if any of the keys are invalid.
   */
  async setAuthorizedKeys(keys) {
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
  },

  /**
   * @callback allowlistingCallback
   * @param {string} domain The domain to allowlist.
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
   *   "invalid_timestamp", or "invalid_signature".
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
