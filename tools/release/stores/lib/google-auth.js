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

// Gets Google access tokens in GitLab CI without any stored secret.
//
// 1. GitLab issues the job an OIDC ID token (`id_tokens:` in .gitlab-ci.yml).
// 2. `exchangeIdToken()` trades it at Google STS for a federated token,
//    using a Workload Identity Federation pool that trusts gitlab.com. That
//    token can already use resources granted to the pool's principals, such
//    as Secret Manager secrets.
// 3. `generateServiceAccountToken()` turns the federated token into a
//    one-hour token for a service account, e.g. one registered with a
//    Chrome Web Store publisher.
//
// See https://docs.gitlab.com/ci/cloud_services/google_cloud/

import { pickHttpOptions, readJson, request } from "./http.js";
import { requireOptions } from "./options.js";

/**
 * Scope for Google Cloud APIs such as Secret Manager.
 */
export const CLOUD_PLATFORM_SCOPE =
  "https://www.googleapis.com/auth/cloud-platform";

/**
 * Scope required by every Chrome Web Store API method.
 *
 * @see https://developer.chrome.com/docs/webstore/service-accounts
 */
export const CHROME_WEB_STORE_SCOPE =
  "https://www.googleapis.com/auth/chromewebstore";

const STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS_URL = "https://iamcredentials.googleapis.com/v1";

/**
 * Builds the audience that Google STS expects for a Workload Identity
 * Federation provider.
 *
 * The GitLab `id_tokens` `aud` is usually the same path with an `https:`
 * prefix, which is the provider's default allowed audience.
 *
 * @param {object} options
 * @param {string|number} options.projectNumber Number (not ID) of the Google
 *   Cloud project that owns the pool.
 * @param {string} options.poolId Workload identity pool ID.
 * @param {string} options.providerId Workload identity pool provider ID.
 * @returns {string} Audience, e.g.
 *   `//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/gitlab/providers/gitlab-com`.
 * @throws {TypeError} If an option is missing.
 */
export function workloadIdentityAudience(options) {
  requireOptions(
    options,
    ["projectNumber", "poolId", "providerId"],
    "workloadIdentityAudience",
  );
  const { projectNumber, poolId, providerId } = options;

  return (
    `//iam.googleapis.com/projects/${projectNumber}/locations/global` +
    `/workloadIdentityPools/${poolId}/providers/${providerId}`
  );
}

/**
 * Exchanges a GitLab ID token for a federated Google access token with the
 * `cloud-platform` scope.
 *
 * @see https://cloud.google.com/iam/docs/reference/sts/rest/v1/TopLevel/token
 *
 * @param {object & import("./http.js").HttpOptions} options
 * @param {string} options.idToken GitLab ID token, e.g. `$GCP_ID_TOKEN`.
 * @param {string} options.audience Provider audience, see
 *   `workloadIdentityAudience()`.
 * @returns {Promise<string>} The federated access token.
 * @throws {TypeError} If an option is missing.
 * @throws {import("./errors.js").HttpError} If STS rejects the exchange,
 *   e.g. because the provider's attribute condition doesn't match the job.
 */
export async function exchangeIdToken(options) {
  requireOptions(options, ["idToken", "audience"], "exchangeIdToken");
  const { idToken, audience } = options;

  const response = await request(STS_TOKEN_URL, {
    ...pickHttpOptions(options),
    method: "POST",
    idempotent: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience,
      scope: CLOUD_PLATFORM_SCOPE,
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectToken: idToken,
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
    }),
  });
  const data = await readJson(response);

  if (!data?.access_token) {
    throw new Error("Google STS response contains no access_token");
  }

  return data.access_token;
}

/**
 * Creates a one-hour access token for a service account, authenticated with
 * a federated token.
 *
 * The pool's principal needs `roles/iam.workloadIdentityUser` on the service
 * account.
 *
 * @see https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken
 *
 * @param {object & import("./http.js").HttpOptions} options
 * @param {string} options.federatedToken Token from `exchangeIdToken()`.
 * @param {string} options.serviceAccountEmail Email of the service account
 *   to impersonate.
 * @param {string[]} options.scopes Scopes of the new token, e.g.
 *   `[CHROME_WEB_STORE_SCOPE]`.
 * @returns {Promise<string>} The service account's access token.
 * @throws {TypeError} If an option is missing.
 * @throws {import("./errors.js").HttpError} If impersonation is denied.
 */
export async function generateServiceAccountToken(options) {
  requireOptions(
    options,
    ["federatedToken", "serviceAccountEmail", "scopes"],
    "generateServiceAccountToken",
  );
  const { federatedToken, serviceAccountEmail, scopes } = options;

  const serviceAccount = encodeURIComponent(serviceAccountEmail);
  const response = await request(
    `${IAM_CREDENTIALS_URL}/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    {
      ...pickHttpOptions(options),
      method: "POST",
      idempotent: true,
      headers: {
        Authorization: `Bearer ${federatedToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: scopes, lifetime: "3600s" }),
    },
  );
  const data = await readJson(response);

  if (!data?.accessToken) {
    throw new Error("IAM Credentials response contains no accessToken");
  }

  return data.accessToken;
}
