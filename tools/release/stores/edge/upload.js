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

// Uploads a host's Chrome (mv3) build to Microsoft Edge Add-ons and submits
// it for review. Meant to run in the release pipeline of a version tag.
//
// Usage: node tools/release/stores/edge/upload.js <host> <version> [--draft-only]
//
// Environment: the same as chrome/upload.js.

import url from "url";
import { parseArgs } from "util";

import { ErrorCode, createEdgeClient } from "./client.js";
import { getEdgeSecret, loadEdgeProduct } from "./config.js";
import {
  exchangeIdToken,
  workloadIdentityAudience,
} from "../lib/google-auth.js";
import { pickHttpOptions } from "../lib/http.js";
import { requireOptions } from "../lib/options.js";
import {
  checkPackageVersion,
  chromePackagePath,
  readManifestVersion,
  readPackageFile,
} from "../lib/package.js";
import { retryStep } from "../lib/poll.js";

// Upload and submission failures Edge reports without a reason
const RETRY_CODES = [
  ErrorCode.FAILED_WITHOUT_CODE,
  ErrorCode.UNEXPECTED_FAILURE,
];

/**
 * @typedef {object} EdgeUploadResult
 * @property {import("./client.js").Operation} upload The finished package
 *   upload.
 * @property {import("./client.js").Operation|null} submission The accepted
 *   submission, or `null` in draft-only mode.
 */

/**
 * Uploads a host's Chrome release package to its Edge Add-ons product and
 * submits it for review.
 *
 * Steps:
 * 1. Find the host's configuration secret in `edge/config.js`.
 * 2. Check that `manifest.json` in
 *    `host/<host>/dist/release/<host>-chrome-<version>-mv3.zip` has the
 *    expected version.
 * 3. Exchange the GitLab ID token for a federated token, and read the
 *    host's configuration secret with it.
 * 4. Upload the package to the product's draft and wait until Edge has
 *    processed it. If Edge fails without a reason, try again up to 10
 *    times, a minute apart (see `retryStep()`).
 * 5. Submit the draft for review and wait until Edge has accepted the
 *    submission, unless `draftOnly` is set. This doesn't wait for the
 *    review itself. If Edge fails without a reason, try again the same way.
 *
 * Steps 1 to 3 don't change anything in the store, so if one of them fails,
 * nothing has been uploaded yet.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.host Host ID, e.g. `adblockplus`.
 * @param {string} options.version Version being released, e.g. `4.46.0`.
 * @param {string} options.idToken GitLab ID token, e.g. `$GCP_ID_TOKEN`.
 * @param {string} options.audience Workload Identity Federation provider
 *   audience, see `workloadIdentityAudience()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the configuration secrets.
 * @param {boolean} [options.draftOnly=false] Stop after the upload. The
 *   draft then has to be published in Partner Center.
 * @param {string} [options.notes=""] Notes for certification.
 * @param {Record<string, string>} [options.secrets] Host to secret mapping.
 *   Defaults to `EDGE_SECRETS`.
 * @param {(path: string) => Promise<string>} [options.readVersion] Reads the
 *   version from the package's manifest. Defaults to
 *   `readManifestVersion()`.
 * @param {(path: string) => Promise<Blob>} [options.readPackage] Reads the
 *   package file. Defaults to `fs.openAsBlob`.
 * @param {string} [options.rootPath] Repository root the package path is
 *   relative to. Defaults to this repository.
 * @param {(message: string) => void} [options.log] Progress output.
 *   Defaults to printing to stdout.
 * @returns {Promise<EdgeUploadResult>} What was uploaded and submitted.
 * @throws {Error} If the host isn't configured, the package can't be read,
 *   its manifest has a different version than `version`, or the
 *   configuration secret is invalid.
 * @throws {TypeError} If an option or a configuration value is missing.
 * @throws {import("../lib/errors.js").HttpError} If Google or Edge rejects a
 *   request, e.g. HTTP 401 when the API key has expired.
 * @throws {import("../lib/errors.js").StoreOperationError} If Edge couldn't
 *   process the upload or the submission in any attempt. Code
 *   `InProgressSubmission` means the previous version is still in review.
 */
export async function uploadToEdge(options) {
  requireOptions(
    options,
    ["host", "version", "idToken", "audience", "project"],
    "uploadToEdge",
  );
  const {
    host,
    version,
    idToken,
    audience,
    project,
    draftOnly = false,
    notes = "",
    secrets,
    readVersion = readManifestVersion,
    readPackage,
    rootPath,
    log = console.log, // allow-console
  } = options;
  const httpOptions = pickHttpOptions(options);

  const secret = getEdgeSecret(host, secrets);
  const packagePath = chromePackagePath(host, version, rootPath);
  await checkPackageVersion(packagePath, version, readVersion);

  const federatedToken = await exchangeIdToken({
    ...httpOptions,
    idToken,
    audience,
  });
  const product = await loadEdgeProduct({
    ...httpOptions,
    secret,
    accessToken: federatedToken,
    project,
  });

  const pkg = await readPackageFile(packagePath, readPackage);
  const client = createEdgeClient({
    ...httpOptions,
    apiKey: product.apiKey,
    clientId: product.clientId,
    productId: product.productId,
  });

  log(`Uploading ${packagePath} to ${product.name} (${product.productId})`);
  const upload = await retryStep(() => client.uploadAndWait(pkg), {
    description: `Uploading ${product.name} ${version}`,
    retryCodes: RETRY_CODES,
    sleep: httpOptions.sleep,
    log,
  });

  if (draftOnly) {
    log(
      `Uploaded ${product.name} ${version} as a draft. ` +
        "Publish it in Partner Center.",
    );
    return { upload, submission: null };
  }

  const submission = await retryStep(() => client.publishAndWait(notes), {
    description: `Submitting ${product.name} ${version}`,
    retryCodes: RETRY_CODES,
    sleep: httpOptions.sleep,
    log,
  });
  log(`Submitted ${product.name} ${version} for review`);
  return { upload, submission };
}

async function run() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "draft-only": { type: "boolean", default: false } },
  });
  const [host, version] = positionals;

  if (!host || !version) {
    console.error("Please provide a host and a version");
    console.error(
      "Usage: node tools/release/stores/edge/upload.js <host> <version> [--draft-only]",
    );
    process.exit(1);
  }

  requireOptions(
    process.env,
    [
      "GCP_ID_TOKEN",
      "GCP_PROJECT_NUMBER",
      "GCP_WORKLOAD_IDENTITY_POOL_ID",
      "GCP_WORKLOAD_IDENTITY_PROVIDER_ID",
    ],
    "edge/upload.js environment",
  );

  await uploadToEdge({
    host,
    version,
    idToken: process.env.GCP_ID_TOKEN,
    audience: workloadIdentityAudience({
      projectNumber: process.env.GCP_PROJECT_NUMBER,
      poolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
      providerId: process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID,
    }),
    project: process.env.GCP_PROJECT_NUMBER,
    draftOnly: values["draft-only"],
  });
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
