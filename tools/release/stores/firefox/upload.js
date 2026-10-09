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

// Uploads a host's Firefox build to Firefox Add-ons (addons.mozilla.org) and
// submits it for review, together with its source code. Meant to run in the
// release pipeline of a version tag.
//
// Usage: node tools/release/stores/firefox/upload.js <host> <version>
//
// Environment: the same as chrome/upload.js.

import path from "path";
import url from "url";

import { createAmoClient, getValidationMessages } from "./client.js";
import { getAmoAddon, loadAmoConfig } from "./config.js";
import { readReleaseNotes, readReviewerNotes } from "./notes.js";
import { StoreOperationError } from "../lib/errors.js";
import {
  exchangeIdToken,
  workloadIdentityAudience,
} from "../lib/google-auth.js";
import { pickHttpOptions } from "../lib/http.js";
import { requireOptions } from "../lib/options.js";
import {
  checkPackageVersion,
  firefoxPackagePath,
  readManifestVersion,
  readPackageFile,
  sourcePackagePath,
} from "../lib/package.js";
import { retryStep } from "../lib/poll.js";

/**
 * Validator warnings the release process accepts, as listed in the "Submit
 * to addons.mozilla.org" steps of the Host release process wiki. Any other
 * warning needs a person to look at it before the version is submitted.
 */
const ACCEPTED_WARNINGS = [
  /Use "browser_specific_settings" instead of "applications"/,
  /The "data_collection_permissions" property is missing/,
  /Unsafe assignment to innerHTML/,
  /The Function constructor is eval/,
  // "Various kinds of not supported warnings" in the wiki
  /not supported/i,
];

/**
 * Returns the validator warnings that aren't in `ACCEPTED_WARNINGS`.
 *
 * @param {import("./client.js").UploadResponse} uploadResponse A processed
 *   upload.
 * @returns {import("./client.js").ValidationMessage[]} Unexpected warnings;
 *   empty if all are accepted.
 */
export function findUnexpectedWarnings(uploadResponse) {
  return getValidationMessages(uploadResponse, "warning").filter(
    ({ message }) =>
      !ACCEPTED_WARNINGS.some((pattern) => pattern.test(message)),
  );
}

/**
 * @typedef {object} AmoUploadResult
 * @property {import("./client.js").UploadResponse} uploadResponse The
 *   validated upload.
 * @property {import("./client.js").PublishResponse} version The submitted
 *   version, with its source code attached.
 */

/**
 * Uploads a host's Firefox release package to its AMO add-on and submits it
 * for review.
 *
 * AMO has no draft: creating the version submits it. Everything that can be
 * checked beforehand is therefore checked first.
 *
 * Steps:
 * 1. Check that `manifest.json` in
 *    `host/<host>/dist/release/<host>-firefox-<version>-mv2.xpi` has the
 *    expected version, and read the release notes and the notes for
 *    reviewers from RELEASE_NOTES.md and STORE_LISTING.md.
 * 2. Exchange the GitLab ID token for a federated token, and read the AMO
 *    configuration secret with it.
 * 3. Upload the package and wait until AMO has validated it. If AMO fails,
 *    try again up to 10 times, a minute apart (see `retryStep()`). Stop if
 *    there are validation errors or warnings that aren't on the accepted
 *    list.
 * 4. Create the version, with the release notes, the notes for reviewers and
 *    Android compatibility. This submits it for review. This isn't retried,
 *    because a second attempt could submit twice.
 * 5. Attach `host/<host>/dist/release/<host>-<version>.tar.gz` as the
 *    version's source code, retrying the same way as step 3.
 *
 * Steps 1 to 3 don't submit anything, so if one of them fails, nothing is
 * waiting for review yet.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.host Host ID, e.g. `adblockplus`.
 * @param {string} options.version Version being released, e.g. `4.46.0`.
 * @param {string} options.idToken GitLab ID token, e.g. `$GCP_ID_TOKEN`.
 * @param {string} options.audience Workload Identity Federation provider
 *   audience, see `workloadIdentityAudience()`.
 * @param {string|number} options.project Google Cloud project ID or number
 *   that holds the configuration secret.
 * @param {string} [options.secret] AMO configuration secret. Defaults to
 *   `AMO_SECRET`.
 * @param {(path: string) => Promise<string>} [options.readVersion] Reads the
 *   version from the package's manifest. Defaults to
 *   `readManifestVersion()`.
 * @param {(path: string) => Promise<Blob>} [options.readPackage] Reads the
 *   package and source files. Defaults to `fs.openAsBlob`.
 * @param {(host: string, version: string) => Promise<string>}
 *   [options.readNotes] Reads the release notes. Defaults to
 *   `readReleaseNotes()`.
 * @param {(host: string, rootPath?: string) => Promise<string>}
 *   [options.readNotesForReviewers] Reads the notes for reviewers. Defaults to
 *   `readReviewerNotes()`.
 * @param {string} [options.rootPath] Repository root the package paths are
 *   relative to. Defaults to this repository.
 * @param {(message: string) => void} [options.log] Progress output.
 *   Defaults to printing to stdout.
 * @returns {Promise<AmoUploadResult>} What was uploaded and submitted.
 * @throws {Error} If a file or note can't be read, the package has a
 *   different version than `version`, the configuration is invalid, or the
 *   source upload failed after the version was submitted.
 * @throws {TypeError} If an option or a configuration value is missing.
 * @throws {StoreOperationError} With code `ValidationFailed` or
 *   `UnexpectedWarnings` if the package didn't pass validation.
 * @throws {import("../lib/errors.js").HttpError} If Google or AMO rejects a
 *   request, e.g. HTTP 429 when uploads are throttled.
 */
export async function uploadToAmo(options) {
  requireOptions(
    options,
    ["host", "version", "idToken", "audience", "project"],
    "uploadToAmo",
  );
  const {
    host,
    version,
    idToken,
    audience,
    project,
    secret,
    readVersion = readManifestVersion,
    readPackage,
    readNotes = readReleaseNotes,
    readNotesForReviewers = readReviewerNotes,
    rootPath,
    log = console.log, // allow-console
  } = options;
  const httpOptions = pickHttpOptions(options);

  const packagePath = firefoxPackagePath(host, version, rootPath);
  const sourcePath = sourcePackagePath(host, version, rootPath);
  await checkPackageVersion(packagePath, version, readVersion);
  const releaseNotes = await readNotes(host, version);
  const reviewerNotes = await readNotesForReviewers(host, rootPath);

  const federatedToken = await exchangeIdToken({
    ...httpOptions,
    idToken,
    audience,
  });
  const config = await loadAmoConfig({
    ...httpOptions,
    accessToken: federatedToken,
    project,
    secret,
  });
  const addon = getAmoAddon(config, host);

  const pkg = await readPackageFile(packagePath, readPackage);
  const source = await readPackageFile(sourcePath, readPackage);
  const client = createAmoClient({
    ...httpOptions,
    issuer: config.issuer,
    secret: config.secret,
    addon: addon.addon,
  });

  log(`Uploading ${packagePath} to ${addon.name} (${addon.addon})`);
  const uploadResponse = await retryStep(() => client.uploadAndWait(pkg), {
    description: `Uploading ${addon.name} ${version}`,
    sleep: httpOptions.sleep,
    log,
  });

  const unexpectedWarnings = findUnexpectedWarnings(uploadResponse);
  if (unexpectedWarnings.length > 0) {
    throw new StoreOperationError({
      store: "amo",
      code: "UnexpectedWarnings",
      message:
        "Validation reported warnings that aren't on the accepted list: " +
        unexpectedWarnings.map(({ message }) => message).join("; "),
      details: unexpectedWarnings,
    });
  }

  log(`Submitting ${addon.name} ${version} for review`);
  const newVersion = await client.publish(uploadResponse.uuid, {
    releaseNotes,
    approvalNotes: reviewerNotes,
    compatibility: addon.android ? ["firefox", "android"] : ["firefox"],
  });

  let submitted;
  try {
    submitted = await retryStep(
      () =>
        client.uploadSource(newVersion.id, source, path.basename(sourcePath)),
      {
        description: `Attaching the source code of ${addon.name} ${version}`,
        sleep: httpOptions.sleep,
        log,
      },
    );
  } catch (error) {
    throw new Error(
      `${addon.name} ${version} was submitted for review, but attaching ` +
        `the source code failed: ${error.message}. Upload ` +
        `${path.basename(sourcePath)} to the version in the AMO developer ` +
        "hub before reviewers pick it up.",
      { cause: error },
    );
  }

  log(
    `Submitted ${addon.name} ${version} for review with its source code ` +
      `(file status: ${submitted?.file?.status ?? "unknown"})`,
  );
  return { uploadResponse, version: submitted };
}

async function run() {
  const [host, version] = process.argv.slice(2);

  if (!host || !version) {
    console.error("Please provide a host and a version");
    console.error(
      "Usage: node tools/release/stores/firefox/upload.js <host> <version>",
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
    "firefox/upload.js environment",
  );

  await uploadToAmo({
    host,
    version,
    idToken: process.env.GCP_ID_TOKEN,
    audience: workloadIdentityAudience({
      projectNumber: process.env.GCP_PROJECT_NUMBER,
      poolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
      providerId: process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID,
    }),
    project: process.env.GCP_PROJECT_NUMBER,
  });
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
