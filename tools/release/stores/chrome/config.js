/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
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

// Chrome Web Store configuration of the hosts released from this
// repository. Each host's configuration lives in a Google Secret Manager
// secret, keyed here by host ID: the part of the release tag before the
// version, e.g. `adblockplus` in `adblockplus-4.46.0`.
//
// Each secret holds a JSON object:
//
//   {
//     "name": "AdBlock",
//     "publisherId": "<Developer Dashboard → Account → Publisher ID>",
//     "itemId": "<extension ID from the store URL>",
//     "serviceAccountEmail": "<service account registered with the publisher>"
//   }
//
// The CI job reads it with its federated token, so for each secret the
// pool's principal for that host (`attribute.release_host/<host>`) needs
// `roles/secretmanager.secretAccessor`.

import { getHostSecret, loadConfigSecret } from "../lib/config-secret.js";
import { requireOptions } from "../lib/options.js";

/**
 * Secret Manager secret holding each host's configuration.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CHROME_WEB_STORE_SECRETS = Object.freeze({
  adblock: "cws-adblock-credentials",
  adblockplus: "cws-abp-credentials",
});

// Chrome extension IDs are 32 characters from the range a-p
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

/**
 * @typedef {object} ChromeWebStoreProduct
 * @property {string} name Product name for log messages.
 * @property {string} publisherId Chrome Web Store publisher ID.
 * @property {string} itemId Extension ID.
 * @property {string} serviceAccountEmail Service account registered with
 *   the publisher.
 */

/**
 * Returns the secret that holds a host's configuration.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {Record<string, string>} [secrets] Host to secret mapping.
 *   Defaults to `CHROME_WEB_STORE_SECRETS`.
 * @returns {string} Secret ID.
 * @throws {Error} If the host isn't configured.
 */
export function getChromeWebStoreSecret(
  host,
  secrets = CHROME_WEB_STORE_SECRETS,
) {
  return getHostSecret(host, secrets, "Chrome Web Store");
}

/**
 * Reads a host's configuration from its secret and checks that it is
 * complete.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.secret Secret ID, from `getChromeWebStoreSecret()`.
 * @param {string} options.accessToken Token allowed to read the secret,
 *   e.g. the federated token from `exchangeIdToken()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the secret.
 * @returns {Promise<ChromeWebStoreProduct>} The host's configuration.
 * @throws {Error} If the secret isn't valid JSON or has an invalid item ID.
 *   The secret's value is never included in the message.
 * @throws {TypeError} If a configuration value is missing.
 * @throws {import("../lib/errors.js").HttpError} If the secret can't be
 *   read, e.g. 403 when the IAM binding is missing or 404 when it has no
 *   version yet.
 */
export async function loadChromeWebStoreProduct(options) {
  requireOptions(
    options,
    ["secret", "accessToken", "project"],
    "loadChromeWebStoreProduct",
  );
  const product = await loadConfigSecret({
    ...options,
    fields: ["name", "publisherId", "itemId", "serviceAccountEmail"],
  });

  if (!EXTENSION_ID_PATTERN.test(product.itemId)) {
    throw new Error(
      `Secret ${options.secret} has an invalid itemId. ` +
        "Extension IDs are 32 letters from a to p.",
    );
  }

  return product;
}
