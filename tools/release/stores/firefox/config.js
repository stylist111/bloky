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

// Firefox Add-ons (addons.mozilla.org, AMO) configuration of the hosts
// released from this repository.
//
// Both add-ons are uploaded with the API key of one AMO account, so a single
// Google Secret Manager secret holds the key and the add-on of each host:
//
//   {
//     "issuer": "<AMO → Manage API Keys → JWT issuer, e.g. user:12345:67>",
//     "secret": "<JWT secret from the same page>",
//     "addons": {
//       "adblock": { "name": "AdBlock", "addon": "adblock-for-firefox", "android": false },
//       "adblockplus": { "name": "Adblock Plus", "addon": "adblock-plus", "android": true }
//     }
//   }
//
// `addon` is the add-on's slug from its AMO URL. `android` marks the version
// as compatible with Firefox for Android.
//
// The CI job reads it with its federated token, so the pool's principals for
// both hosts need `roles/secretmanager.secretAccessor` on the secret.

import { loadConfigSecret } from "../lib/config-secret.js";
import { requireOptions } from "../lib/options.js";

/**
 * Secret Manager secret holding the AMO configuration.
 */
export const AMO_SECRET = "amo-credentials";

const ISSUER_PATTERN = /^user:\d+:\d+$/;

/**
 * @typedef {object} AmoAddon
 * @property {string} name Product name for log messages.
 * @property {string} addon Add-on slug, e.g. `adblock-plus`.
 * @property {boolean} android Whether the version supports Firefox for
 *   Android.
 */

/**
 * @typedef {object} AmoConfig
 * @property {string} issuer AMO API key ("JWT issuer").
 * @property {string} secret AMO API secret ("JWT secret").
 * @property {Record<string, AmoAddon>} addons Add-on of each host.
 */

/**
 * Reads the AMO configuration from its secret and checks the API key's
 * format. Error messages never include the API secret or other values.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.accessToken Token allowed to read the secret,
 *   e.g. the federated token from `exchangeIdToken()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the secret.
 * @param {string} [options.secret=AMO_SECRET] Secret ID.
 * @returns {Promise<AmoConfig>} The AMO configuration.
 * @throws {Error} If the secret isn't valid JSON or the issuer has the wrong
 *   format.
 * @throws {TypeError} If a configuration value is missing.
 * @throws {import("../lib/errors.js").HttpError} If the secret can't be
 *   read, e.g. 403 when the IAM binding is missing.
 */
export async function loadAmoConfig(options) {
  requireOptions(options, ["accessToken", "project"], "loadAmoConfig");
  const secret = options.secret ?? AMO_SECRET;

  const config = await loadConfigSecret({
    ...options,
    secret,
    fields: ["issuer", "secret", "addons"],
  });

  if (!ISSUER_PATTERN.test(config.issuer)) {
    throw new Error(
      `Secret ${secret} has an invalid issuer. Copy the JWT issuer from ` +
        "AMO's API key page, e.g. user:12345:67.",
    );
  }

  return config;
}

/**
 * Returns a host's add-on from the AMO configuration.
 *
 * @param {AmoConfig} config Result of `loadAmoConfig()`.
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @returns {AmoAddon} The host's add-on.
 * @throws {Error} If the host isn't configured.
 * @throws {TypeError} If the host's add-on is incomplete.
 */
export function getAmoAddon(config, host) {
  const addons = config?.addons ?? {};

  if (!Object.hasOwn(addons, host)) {
    throw new Error(
      `No Firefox Add-ons configuration for host "${host}". ` +
        `Known hosts: ${Object.keys(addons).join(", ")}`,
    );
  }

  const addon = addons[host];
  const context = `AMO configuration (${host})`;
  requireOptions(addon, ["name", "addon", "android"], context);

  if (typeof addon.android !== "boolean") {
    throw new TypeError(`${context}: android must be true or false`);
  }

  return addon;
}
