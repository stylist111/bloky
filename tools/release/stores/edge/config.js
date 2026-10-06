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

// Microsoft Edge Add-ons configuration of the hosts released from this
// repository. Each host's configuration lives in a Google Secret Manager
// secret, keyed here by host ID.
//
// Each secret holds a JSON object:
//
//   {
//     "name": "AdBlock",
//     "productId": "<Partner Center → the extension → Product ID (a GUID)>",
//     "clientId": "<Partner Center → Microsoft Edge → Publish API → Client ID>",
//     "apiKey": "<API key from the same page>"
//   }
//
// Partner Center API keys expire after 72 days. To rotate one, add a new
// secret version with the whole object.
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
export const EDGE_SECRETS = Object.freeze({
  adblock: "edge-adblock-credentials",
  adblockplus: "edge-abp-credentials",
});

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @typedef {object} EdgeProduct
 * @property {string} name Product name for log messages.
 * @property {string} productId Partner Center product ID.
 * @property {string} clientId Publish API client ID.
 * @property {string} apiKey Publish API key.
 */

/**
 * Returns the secret that holds a host's configuration.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {Record<string, string>} [secrets] Host to secret mapping.
 *   Defaults to `EDGE_SECRETS`.
 * @returns {string} Secret ID.
 * @throws {Error} If the host isn't configured.
 */
export function getEdgeSecret(host, secrets = EDGE_SECRETS) {
  return getHostSecret(host, secrets, "Edge Add-ons");
}

/**
 * Reads a host's configuration from its secret and checks that it is
 * complete. Error messages never include the API key or other values.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.secret Secret ID, from `getEdgeSecret()`.
 * @param {string} options.accessToken Token allowed to read the secret,
 *   e.g. the federated token from `exchangeIdToken()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the secret.
 * @returns {Promise<EdgeProduct>} The host's configuration.
 * @throws {Error} If the secret isn't valid JSON or has an invalid product
 *   ID.
 * @throws {TypeError} If a configuration value is missing.
 * @throws {import("../lib/errors.js").HttpError} If the secret can't be
 *   read, e.g. 403 when the IAM binding is missing.
 */
export async function loadEdgeProduct(options) {
  requireOptions(
    options,
    ["secret", "accessToken", "project"],
    "loadEdgeProduct",
  );

  const product = await loadConfigSecret({
    ...options,
    fields: ["name", "productId", "clientId", "apiKey"],
  });

  if (!GUID_PATTERN.test(product.productId)) {
    throw new Error(
      `Secret ${options.secret} has an invalid productId. Use the ` +
        "Partner Center product ID (a GUID), not the store's extension ID.",
    );
  }

  return product;
}
