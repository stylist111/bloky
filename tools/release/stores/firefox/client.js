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

// Wrapper for the addons.mozilla.org (AMO) add-ons API v5.

import { createHmac, randomUUID } from "crypto";

import { StoreOperationError } from "../lib/errors.js";
import { pickHttpOptions, readJson, request } from "../lib/http.js";
import { requireOptions } from "../lib/options.js";
import { pollUntil } from "../lib/poll.js";

const API_ROOT = "https://addons.mozilla.org/api/v5/addons";

// AMO accepts at most five minutes
const JWT_LIFETIME_SECONDS = 60;

/**
 * @typedef {object} ValidationMessage
 * @property {"error"|"warning"|"notice"} type Severity.
 * @property {string} message Short description.
 */

/**
 * @typedef {object} UploadResponse
 * @property {string} uuid Upload ID, passed to `publish()`.
 * @property {boolean} processed Whether the validator has finished.
 * @property {boolean} valid Whether validation passed.
 * @property {{messages?: ValidationMessage[]}} [validation] Validator output.
 * @property {string} [version] Version from the uploaded manifest.
 */

/**
 * @typedef {object} PublishResponse
 * @property {number} id Version ID, passed to `uploadSource()`.
 * @property {{status: string}} [file] The version's file, e.g. with status
 *   `unreviewed`.
 */

/**
 * @typedef {object} PublishOptions
 * @property {string} releaseNotes Release notes shown to users.
 * @property {string} approvalNotes Notes for reviewers.
 * @property {string[]} compatibility Applications, e.g.
 *   `["firefox", "android"]` for desktop and Android.
 */

/**
 * @typedef {object} AmoClient
 * @property {(pkg: Blob) => Promise<UploadResponse>} upload
 * @property {(pkg: Blob, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<UploadResponse>} uploadAndWait
 * @property {(uploadUuid: string, publishOptions: PublishOptions) => Promise<PublishResponse>} publish
 * @property {(versionId: number, source: Blob, fileName: string) => Promise<PublishResponse>} uploadSource
 */

/**
 * Creates a client for one AMO add-on.
 *
 * Release flow: `uploadAndWait()` uploads and validates the package,
 * `publish()` creates a version from it and so submits it for review, then
 * `uploadSource()` attaches the source code. A new version disables an older
 * one that is still awaiting review.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.issuer AMO API key ("JWT issuer").
 * @param {string} options.secret AMO API secret ("JWT secret").
 * @param {string} options.addon Add-on slug, e.g. `adblock-plus`.
 * @returns {AmoClient} Client bound to that add-on.
 * @throws {TypeError} If an option is missing.
 */
export function createAmoClient(options) {
  requireOptions(options, ["issuer", "secret", "addon"], "createAmoClient");
  const { issuer, secret, addon } = options;
  const httpOptions = pickHttpOptions(options);
  const versionsUrl = `${API_ROOT}/addon/${encodeURIComponent(addon)}/versions`;
  // A function, so every request and retry gets a fresh token
  const authorization = () => ({
    Authorization: `JWT ${createJwt(issuer, secret)}`,
  });

  /**
   * Uploads a package to the listed channel. AMO validates it in the
   * background, see `uploadAndWait()`.
   *
   * @see https://mozilla.github.io/addons-server/topics/api/addons.html#upload-create
   *
   * @param {Blob} pkg The xpi, e.g. from `fs.openAsBlob(path)`.
   * @returns {Promise<UploadResponse>} The upload, usually not validated yet.
   * @throws {import("../lib/errors.js").HttpError} If AMO rejects the
   *   upload.
   */
  async function upload(pkg) {
    const form = new FormData();
    form.append("upload", pkg, "extension.xpi");
    form.append("channel", "listed");

    const response = await request(`${API_ROOT}/upload/`, {
      ...httpOptions,
      method: "POST",
      // Uploading the same package again only leaves an unused upload behind
      idempotent: true,
      headers: authorization,
      body: form,
    });
    return readJson(response);
  }

  /**
   * Uploads a package and waits until AMO has validated it. Warnings don't
   * fail validation; check them with `getValidationMessages()`.
   *
   * @see https://mozilla.github.io/addons-server/topics/api/addons.html#upload-detail
   *
   * @param {Blob} pkg The xpi, e.g. from `fs.openAsBlob(path)`.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing for
   *   the wait.
   * @returns {Promise<UploadResponse>} The validated upload.
   * @throws {StoreOperationError} With code `ValidationFailed` if the package
   *   has validation errors. `details` lists them.
   * @throws {import("../lib/errors.js").HttpError} If AMO rejects the
   *   upload.
   * @throws {import("../lib/errors.js").PollTimeoutError} If validation takes
   *   longer than the timeout.
   */
  async function uploadAndWait(pkg, pollOptions = {}) {
    const { uuid } = await upload(pkg);

    const result = await pollUntil(
      async () => {
        const response = await request(`${API_ROOT}/upload/${uuid}/`, {
          ...httpOptions,
          headers: authorization,
        });
        const status = await readJson(response);
        return { done: Boolean(status?.processed), value: status };
      },
      {
        description: `AMO validation of upload ${uuid}`,
        sleep: httpOptions.sleep,
        ...pollOptions,
      },
    );

    if (!result.valid) {
      const errors = getValidationMessages(result, "error");
      throw new StoreOperationError({
        store: "amo",
        code: "ValidationFailed",
        message: errors.map(({ message }) => message).join("; ") || uuid,
        details: errors,
      });
    }

    return result;
  }

  /**
   * Creates a version from a validated upload, which submits it for review.
   *
   * This is never retried after a server error, because the version may
   * already exist.
   *
   * @see https://mozilla.github.io/addons-server/topics/api/addons.html#version-create
   *
   * @param {string} uploadUuid `uuid` of the upload from `uploadAndWait()`.
   * @param {PublishOptions} publishOptions Notes and compatibility.
   * @returns {Promise<PublishResponse>} The new version.
   * @throws {import("../lib/errors.js").HttpError} If AMO rejects the
   *   version.
   */
  async function publish(
    uploadUuid,
    { releaseNotes, approvalNotes, compatibility },
  ) {
    const response = await request(`${versionsUrl}/`, {
      ...httpOptions,
      method: "POST",
      idempotent: false,
      headers: () => ({
        ...authorization(),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        upload: uploadUuid,
        release_notes: { "en-US": releaseNotes },
        approval_notes: approvalNotes,
        compatibility,
      }),
    });
    return readJson(response);
  }

  /**
   * Attaches the source code archive to a version.
   *
   * @see https://mozilla.github.io/addons-server/topics/api/addons.html#version-edit
   *
   * @param {number} versionId `id` of the version from `publish()`.
   * @param {Blob} source The source archive.
   * @param {string} fileName Name reviewers see, e.g.
   *   `adblockplus-4.46.0.tar.gz`.
   * @returns {Promise<PublishResponse>} The updated version.
   * @throws {import("../lib/errors.js").HttpError} If AMO rejects the source.
   */
  async function uploadSource(versionId, source, fileName) {
    const form = new FormData();
    form.append("source", source, fileName);

    const response = await request(`${versionsUrl}/${versionId}/`, {
      ...httpOptions,
      method: "PATCH",
      // Sending the same source again replaces it with identical content
      idempotent: true,
      headers: authorization,
      body: form,
    });
    return readJson(response);
  }

  return Object.freeze({ upload, uploadAndWait, publish, uploadSource });
}

/**
 * Returns the validator messages of one severity.
 *
 * @param {UploadResponse} upload A validated upload.
 * @param {"error"|"warning"|"notice"} type Severity to return.
 * @returns {ValidationMessage[]} Matching messages; empty if there are none.
 */
export function getValidationMessages(upload, type) {
  const messages = upload?.validation?.messages ?? [];
  return messages.filter((message) => message.type === type);
}

/**
 * Creates the JWT that authenticates one request to the AMO API.
 *
 * AMO expects a new token for every request. Each one is HS256-signed with
 * the API secret and has the API key as issuer, a unique `jti`, and an
 * expiry at most five minutes after `iat`. The runner's clock has to be
 * roughly correct.
 *
 * @see https://mozilla.github.io/addons-server/topics/api/auth.html
 */
function createJwt(issuer, secret) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeSegment({ alg: "HS256", typ: "JWT" });
  const payload = encodeSegment({
    iss: issuer,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + JWT_LIFETIME_SECONDS,
  });
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
