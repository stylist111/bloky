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

// Store configurations live in Google Secret Manager, one JSON secret per
// store and host. These helpers find and read them.

import { pickHttpOptions } from "./http.js";
import { requireOptions } from "./options.js";
import { accessSecretVersion } from "./secret-manager.js";

/**
 * Returns the secret that holds a host's configuration for a store.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {Record<string, string>} secrets Host to secret mapping.
 * @param {string} storeName Store name for the error message, e.g.
 *   `Chrome Web Store`.
 * @returns {string} Secret ID.
 * @throws {Error} If the host isn't configured.
 */
export function getHostSecret(host, secrets, storeName) {
  if (!Object.hasOwn(secrets, host)) {
    throw new Error(
      `No ${storeName} configuration for host "${host}". ` +
        `Known hosts: ${Object.keys(secrets).join(", ")}`,
    );
  }

  return secrets[host];
}

/**
 * Reads a JSON configuration secret and checks that the required fields are
 * set. Error messages name the secret and the missing fields, never the
 * secret's value.
 *
 * @param {object & import("./http.js").HttpOptions} options
 * @param {string} options.secret Secret ID.
 * @param {string} options.accessToken Token allowed to read the secret,
 *   e.g. the federated token from `exchangeIdToken()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the secret.
 * @param {string[]} options.fields Fields that must be set.
 * @returns {Promise<Record<string, any>>} The parsed configuration.
 * @throws {Error} If the secret isn't valid JSON.
 * @throws {TypeError} If a required field is missing.
 * @throws {import("./errors.js").HttpError} If the secret can't be read,
 *   e.g. 403 when the IAM binding is missing or 404 when it has no version.
 */
export async function loadConfigSecret(options) {
  requireOptions(
    options,
    ["secret", "accessToken", "project", "fields"],
    "loadConfigSecret",
  );
  const { secret, accessToken, project, fields } = options;

  const value = await accessSecretVersion({
    ...pickHttpOptions(options),
    accessToken,
    project,
    secret,
  });

  let config;
  try {
    config = JSON.parse(value);
  } catch (error) {
    throw new Error(`Secret ${secret} doesn't contain valid JSON`, {
      cause: error,
    });
  }

  requireOptions(config, fields, `Secret ${secret}`);
  return config;
}
