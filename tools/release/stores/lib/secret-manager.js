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

import { pickHttpOptions, readJson, request } from "./http.js";
import { requireOptions } from "./options.js";

const SECRET_MANAGER_URL = "https://secretmanager.googleapis.com/v1";

/**
 * Reads one version of a Google Secret Manager secret.
 *
 * The CRC32C checksum Secret Manager returns isn't verified, because Node
 * has no built-in CRC32C. TLS already protects the payload in transit.
 *
 * @see https://cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets.versions/access
 *
 * @param {object & import("./http.js").HttpOptions} options
 * @param {string} options.accessToken Token with the `cloud-platform` scope,
 *   e.g. the federated token from `exchangeIdToken()`. Its principal needs
 *   `roles/secretmanager.secretAccessor` on the secret.
 * @param {string|number} options.project Google Cloud project ID or number.
 * @param {string} options.secret Secret ID, e.g. `cws-adblock-credentials`.
 * @param {string} [options.version="latest"] Version number or alias.
 * @returns {Promise<string>} The secret value, decoded as UTF-8.
 * @throws {TypeError} If an option is missing.
 * @throws {import("./errors.js").HttpError} If the secret or version doesn't
 *   exist (404) or access is denied (403).
 */
export async function accessSecretVersion(options) {
  requireOptions(
    options,
    ["accessToken", "project", "secret"],
    "accessSecretVersion",
  );
  const { accessToken, project, secret, version = "latest" } = options;

  const name =
    `projects/${encodeURIComponent(project)}` +
    `/secrets/${encodeURIComponent(secret)}` +
    `/versions/${encodeURIComponent(version)}`;
  const response = await request(`${SECRET_MANAGER_URL}/${name}:access`, {
    ...pickHttpOptions(options),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(response);

  if (typeof data?.payload?.data !== "string") {
    throw new Error(`Secret Manager response for ${name} contains no payload`);
  }

  return Buffer.from(data.payload.data, "base64").toString("utf8");
}
