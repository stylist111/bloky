/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  type MessageSender,
  addTrustedMessageTypes,
  port
} from "../../core/messaging/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { info } from "../../info/background";
import * as logger from "../../logger/background";

import { type Message } from "~/core/messaging/shared";
import { FilterOrigin } from "~/filters/shared";
import type { PremiumGetAuthPayloadOptions } from "./bypass.types";
import type {
  AllowlistState,
  ExtensionInfo,
  PayloadAndExtensionInfo
} from "../shared";

/**
 * Algorithm used to verify authenticity of sender
 */
const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: { name: "SHA-512" }
};
/**
 * Time (in milliseconds) from now for which we consider signatures to be valid
 * based on their associated timestamps
 */
const signatureExpiration = 6 * 60 * 60 * 1000;

/**
 * Converts base64 string into array buffer
 *
 * @param str - base64 string
 *
 * @returns array buffer
 */
function base64ToArrayBuffer(str: string): Uint8Array {
  const decodedData = atob(str);
  return Uint8Array.from(decodedData, (c) => c.charCodeAt(0));
}

/**
 * Encodes request data to sign for verifying authenticity of sender
 *
 * @param domain - Sender domain
 * @param timestamp - Timestamp of current date and time
 *
 * @returns Encoded request data
 */
function getAllowData(domain: string, timestamp: number): Uint8Array {
  const str = `${domain},${timestamp}`;
  return new TextEncoder().encode(str);
}

/**
 * Generates public key from string for verifying signatures
 *
 * @param key - public key string
 *
 * @returns public key
 */
async function getKey(key: string): Promise<CryptoKey> {
  const abKey = base64ToArrayBuffer(key);
  return await crypto.subtle.importKey("spki", abKey, algorithm, false, [
    "verify"
  ]);
}

/**
 * Checks if the message is a valid premium.getAuthPayload message
 *
 * @param candidate - The message to check
 *
 * @returns whether the message is a valid premium.getAuthPayload message
 */
function isPremiumGetAuthPayloadMessage(
  candidate: unknown
): candidate is PremiumGetAuthPayloadOptions {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "signature" in candidate &&
    "timestamp" in candidate
  );
}

/**
 * Checks whether signature matches data and any of the known public keys
 * that are authorized to use the bypass API
 *
 * @param domain - Sender domain
 * @param timestamp - Timestamp of current date and time
 * @param signature - Signature for provided domain and timestamp
 *
 * @returns whether signature matches data and any authorized public key
 */
async function verifySignature(
  domain: string,
  timestamp: number,
  signature: string
): Promise<boolean> {
  const data = getAllowData(domain, timestamp);
  const abSignature = base64ToArrayBuffer(signature);
  const authorizedKeys = Prefs.get("bypass_authorizedKeys");

  if (!Array.isArray(authorizedKeys)) {
    logger.error("bypass_authorizedKeys is not an array");
    return false;
  }

  const promisedValidations = authorizedKeys.map(async (key) => {
    if (typeof key !== "string") {
      return false;
    }

    return await verifySignatureWithKey(data, abSignature, key);
  });
  const validations = await Promise.all(promisedValidations);

  return validations.some((isValid) => isValid);
}

/**
 * Checks whether signature matches data and public key
 *
 * @param data - Encoded data
 * @param signature - Signature for encoded data
 * @param pubKey - Public key
 *
 * @returns whether signature matches data and public key
 */
async function verifySignatureWithKey(
  data: Uint8Array,
  signature: Uint8Array,
  pubKey: string
): Promise<boolean> {
  return await crypto.subtle.verify(
    algorithm,
    await getKey(pubKey),
    signature,
    data
  );
}

/**
 * Checks whether timestamp is valid
 *
 * @param timestamp - Timestamp
 *
 * @returns whether timestamp is valid
 */
function verifyTimestamp(timestamp: number): boolean {
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    return false;
  }

  const timeDiff = Date.now() - timestamp;
  return timeDiff < signatureExpiration;
}

/**
 * Checks if the allowlist is active for the given tab
 *
 * @param sender - The message sender
 *
 * @returns Whether the allowlist is active
 */
async function getAllowlistState(
  sender: MessageSender
): Promise<AllowlistState> {
  const tabId = sender?.tab?.id;
  if (!tabId) {
    return {
      status: false,
      source: null,
      oneCA: false
    };
  }

  const allowlistingFilters = await ewe.filters.getAllowingFilters(tabId);
  let source = null;

  for (const filter of allowlistingFilters) {
    // eslint-disable-next-line no-await-in-loop
    const metadata = await ewe.filters.getMetadata(filter);
    const { origin } = metadata ?? {};

    if (origin === FilterOrigin.web) {
      source = "1ca";
      break;
    } else {
      source = "user";
      // Don't break here, continue searching in case there's a "web" origin
    }
  }

  return {
    status: allowlistingFilters.length > 0,
    source,
    oneCA: true
  };
}

/**
 * Verifies the request
 *
 * @param message - The message to verify
 * @param sender - The message sender
 *
 * @returns Whether the request is valid
 */
async function verifyRequest(
  message: PremiumGetAuthPayloadOptions,
  sender: MessageSender
): Promise<boolean> {
  if (!sender?.tab?.url) {
    return false;
  }

  try {
    const { signature, timestamp } = message;
    const domain = new URL(sender.tab.url).hostname;
    if (!verifyTimestamp(timestamp)) {
      return false;
    }

    return await verifySignature(domain, timestamp, signature);
  } catch {
    return false;
  }
}

/**
 * Gets the extension info
 *
 * @param sender - The message sender
 *
 * @returns The extension info
 */
async function getExtensionInfo(
  sender: MessageSender
): Promise<ExtensionInfo | null> {
  try {
    const allowlist = await getAllowlistState(sender);

    return {
      name: info.baseName,
      version: info.addonVersion,
      allowlistState: allowlist
    };
  } catch (error) {
    logger.error("Error in getExtensionInfo:", error);
    return null;
  }
}

/**
 * Handles the premium.getAuthPayload message
 *
 * @param message - The message to handle
 * @param sender - The message sender
 *
 * @returns The payload and extension info
 */
async function handleGetAuthPayloadMessage(
  message: Message,
  sender: MessageSender
): Promise<PayloadAndExtensionInfo | null> {
  if (!isPremiumGetAuthPayloadMessage(message)) {
    return null;
  }

  if (!(await verifyRequest(message, sender))) {
    return null;
  }

  const extensionInfo = await getExtensionInfo(sender);

  return { extensionInfo };
}

/**
 * Initializes the bypass module
 */
export function start(): void {
  port.on("premium.getAuthPayload", handleGetAuthPayloadMessage);
  addTrustedMessageTypes(null, ["premium.getAuthPayload"]);
}
