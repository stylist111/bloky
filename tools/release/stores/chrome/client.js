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

// Wrapper for the Chrome Web Store API V2.
//
// See https://developer.chrome.com/docs/webstore/api/reference/rest

import { StoreOperationError } from "../lib/errors.js";
import { pickHttpOptions, readJson, request } from "../lib/http.js";
import { requireOptions } from "../lib/options.js";
import { pollUntil } from "../lib/poll.js";

const API_ROOT = "https://chromewebstore.googleapis.com";

/**
 * States of a package upload.
 *
 * @see https://developer.chrome.com/docs/webstore/api/reference/rest/v2/UploadState
 * @readonly
 * @enum {string}
 */
export const UploadState = Object.freeze({
  SUCCEEDED: "SUCCEEDED",
  IN_PROGRESS: "IN_PROGRESS",
  FAILED: "FAILED",
  NOT_FOUND: "NOT_FOUND",
});

/**
 * @typedef {object} UploadResponse
 * @property {string} name Resource name, `publishers/{id}/items/{id}`.
 * @property {string} itemId Extension ID.
 * @property {string} [crxVersion] Version from the uploaded manifest. Unset
 *   while the upload is still being processed.
 * @property {UploadState} uploadState State of the upload.
 */

/**
 * @typedef {object} PublishResponse
 * @property {string} name Resource name.
 * @property {string} itemId Extension ID.
 * @property {string} state State of the new submission, usually
 *   `PENDING_REVIEW`.
 * @property {{warnings: {reason: string, description: string}[]}}
 *   [warningInfo] Non-blocking validation warnings.
 */

/**
 * @typedef {object} ChromeWebStoreClient
 * @property {(pkg: Blob) => Promise<UploadResponse>} upload
 * @property {(pkg: Blob, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<UploadResponse>} uploadAndWait
 * @property {() => Promise<PublishResponse>} publish
 */

/**
 * Creates a client for one Chrome Web Store item.
 *
 * Release flow: `uploadAndWait()` replaces the item's draft package, then
 * `publish()` submits the draft for review.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.accessToken Access token with the
 *   `chromewebstore` scope, from `generateServiceAccountToken()`.
 * @param {string} options.publisherId Publisher ID from the developer
 *   dashboard.
 * @param {string} options.itemId Extension ID, e.g.
 *   `cfhdojbkjhnklbpkdaibdccddilifddb`.
 * @returns {ChromeWebStoreClient} Client bound to that item.
 * @throws {TypeError} If an option is missing.
 */
export function createChromeWebStoreClient(options) {
  requireOptions(
    options,
    ["accessToken", "publisherId", "itemId"],
    "createChromeWebStoreClient",
  );
  const { accessToken, publisherId, itemId } = options;
  const httpOptions = pickHttpOptions(options);
  const name =
    `publishers/${encodeURIComponent(publisherId)}` +
    `/items/${encodeURIComponent(itemId)}`;
  const authorization = { Authorization: `Bearer ${accessToken}` };

  /**
   * Uploads a new package to the item's draft. Large packages may still be
   * processing when this returns, see `uploadAndWait()`.
   *
   * @see https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload
   *
   * @param {Blob} pkg The mv3 zip, e.g. from `fs.openAsBlob(path)`.
   * @returns {Promise<UploadResponse>} The upload result.
   * @throws {import("../lib/errors.js").HttpError} If the store rejects the
   *   upload.
   */
  async function upload(pkg) {
    const response = await request(`${API_ROOT}/upload/v2/${name}:upload`, {
      ...httpOptions,
      method: "POST",
      // Uploading the same package again only replaces the draft
      idempotent: true,
      headers: { ...authorization, "Content-Type": "application/zip" },
      body: pkg,
    });
    return readJson(response);
  }

  /**
   * Uploads a package and waits until the store has processed it.
   *
   * If processing happens in the background, this polls the item status
   * until the upload is done. The returned `crxVersion` is only set when
   * the store processed the upload right away.
   *
   * @see https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus
   *
   * @param {Blob} pkg The mv3 zip, e.g. from `fs.openAsBlob(path)`.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing for
   *   the wait.
   * @returns {Promise<UploadResponse>} The upload result, with
   *   `uploadState: "SUCCEEDED"`.
   * @throws {StoreOperationError} If the upload failed. `code` is the
   *   upload state, e.g. `FAILED`.
   * @throws {import("../lib/errors.js").HttpError} If the store rejects the
   *   upload.
   * @throws {import("../lib/errors.js").PollTimeoutError} If processing takes
   *   longer than the timeout.
   */
  async function uploadAndWait(pkg, pollOptions = {}) {
    const result = await upload(pkg);

    if (result?.uploadState === UploadState.SUCCEEDED) {
      return result;
    }
    if (result?.uploadState !== UploadState.IN_PROGRESS) {
      throw uploadFailed(itemId, result?.uploadState, result);
    }

    await pollUntil(
      async () => {
        const response = await request(`${API_ROOT}/v2/${name}:fetchStatus`, {
          ...httpOptions,
          headers: authorization,
        });
        const status = await readJson(response);
        const state = status?.lastAsyncUploadState;

        if (state === UploadState.IN_PROGRESS) {
          return { done: false, value: state };
        }
        if (state === UploadState.SUCCEEDED) {
          return { done: true, value: state };
        }

        throw uploadFailed(itemId, state, status);
      },
      {
        description: `Chrome Web Store upload for ${itemId}`,
        sleep: httpOptions.sleep,
        ...pollOptions,
      },
    );

    return { ...result, uploadState: UploadState.SUCCEEDED };
  }

  /**
   * Submits the current draft for review. It goes live as soon as the
   * review passes.
   *
   * This is never retried after a server error, because the submission may
   * already exist. Check the Developer Dashboard before trying again.
   *
   * @see https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
   *
   * @returns {Promise<PublishResponse>} The new submission's state.
   * @throws {import("../lib/errors.js").HttpError} If the store rejects the
   *   submission.
   * @throws {StoreOperationError} With code `UNKNOWN` if the store answers
   *   without the submission's state, so it's unclear whether the draft was
   *   submitted.
   */
  async function publish() {
    const response = await request(`${API_ROOT}/v2/${name}:publish`, {
      ...httpOptions,
      method: "POST",
      idempotent: false,
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
    });
    const result = await readJson(response);

    if (!result?.state) {
      throw new StoreOperationError({
        store: "chrome-web-store",
        code: "UNKNOWN",
        message:
          `Submitting item ${itemId} returned no state. ` +
          "Check in the Developer Dashboard whether it was submitted.",
        details: result,
      });
    }

    return result;
  }

  return Object.freeze({ upload, uploadAndWait, publish });
}

function uploadFailed(itemId, state, details) {
  return new StoreOperationError({
    store: "chrome-web-store",
    code: state ?? "UNKNOWN",
    message: `Upload for item ${itemId} ended in state ${state}`,
    details,
  });
}
