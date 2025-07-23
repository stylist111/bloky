/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import crypto from "crypto";

import { blockHideUrl } from "../test-server/host-server/urls.js";
import { updatePrefs } from "./extension.js";

const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: { name: "SHA-512" },
};
let keyPair;
let publicKey;

/**
 * Generates the encryption keys
 */
async function generateEncryptionKeys() {
  // Generate the key pair
  keyPair = await crypto.subtle.generateKey(
    algorithm,
    true, // Whether the key is exportable
    ["sign", "verify"], // Usage for private and public keys
  );

  // Export the public key
  publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
}

/**
 * Converts an array buffer byte array into a base64 string.
 *
 * @param {Uint8Array|ArrayBuffer} buffer - Byte array of any data.
 * @return {string} The same data, encoded as a base64 string.
 */
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Encrypts the message using the private key.
 *
 * @param {string} message - The message to encrypt.
 * @returns {Promise<string>}
 */
async function encryptMessage(message) {
  const abData = new TextEncoder().encode(message);
  const abSignature = await crypto.subtle.sign(algorithm, keyPair.privateKey, abData);
  return arrayBufferToBase64(abSignature);
}

/**
 * Replaces the default public key in the extension used for signing the messages
 * @param {string} prefsKeyName The pref key name.
 */
export async function updateExtPrefAPIKey(initOptionsFn, prefsKeyName) {
  if (!keyPair) {
    await generateEncryptionKeys();
  }

  // update the allowlisting authorized keys
  const publicKeyBase64 = arrayBufferToBase64(publicKey);

  return updatePrefs(initOptionsFn, prefsKeyName, [publicKeyBase64]);
}

/**
 * Sends a public API command to the content-script.
 *
 * @param {string} [triggerEventName] - The event name to trigger
 * @param {string} [responseEventName] - The event name to listen on
 * @param {object} [extraParams] - Extra parameters to be sent on the event.
 * @returns {Promise<!IThenable<T>|*>}
 */
export async function sendExtCommand({ triggerEventName, responseEventName, options }) {
  const parsedUrl = new URL(blockHideUrl);
  const domain = parsedUrl.hostname;
  const timestamp = Date.now();
  const data = `${domain},${timestamp}`;
  const signature = await encryptMessage(data);

  return driver.executeAsyncScript(
    (params, callback) => {
      const event = new CustomEvent(params.triggerEventName, {
        detail: {
          domain: params.domain,
          signature: params.signature,
          timestamp: params.timestamp,
          options: params.options,
        },
      });

      // listen for "domain_allowlisting_success" event
      document.addEventListener(params.responseEventName, (ev) =>
        callback(ev.detail ? ev.detail : true),
      );

      // dispatch the event, will be intercepted by the content-script
      document.dispatchEvent(event);

      // if the event is not received in 8 seconds, consider it failed
      setTimeout(() => callback(null), 8000);
    },
    { domain, signature, timestamp, options, triggerEventName, responseEventName },
  );
}
