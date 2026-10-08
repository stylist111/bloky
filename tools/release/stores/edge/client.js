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

// Wrapper for the Microsoft Edge Add-ons Update REST API v1.1.
//
// See https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference

import { StoreOperationError } from "../lib/errors.js";
import { pickHttpOptions, readJson, request } from "../lib/http.js";
import { requireOptions } from "../lib/options.js";
import { pollUntil } from "../lib/poll.js";

const API_ROOT = "https://api.addons.microsoftedge.microsoft.com";

/**
 * States of an upload or publish operation.
 *
 * @readonly
 * @enum {string}
 */
export const OperationStatus = Object.freeze({
  IN_PROGRESS: "InProgress",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
});

/**
 * Error codes of failed operations.
 *
 * @see https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference#check-the-publishing-status
 * @readonly
 * @enum {string}
 */
export const ErrorCode = Object.freeze({
  /** The previous submission is still in review. Retry later. */
  IN_PROGRESS_SUBMISSION: "InProgressSubmission",
  /** The draft has no changes compared to the live version. */
  NO_MODULES_UPDATED: "NoModulesUpdated",
  /** The extension is being unpublished. */
  UNPUBLISH_IN_PROGRESS: "UnpublishInProgress",
  /** A module of the submission isn't valid. */
  MODULE_STATE_UNPUBLISHABLE: "ModuleStateUnPublishable",
  /** The submission failed validation. */
  SUBMISSION_VALIDATION_ERROR: "SubmissionValidationError",
  /** The API can't create new products, only update existing ones. */
  CREATE_NOT_ALLOWED: "CreateNotAllowed",
  /** `Failed` without an error code: irrecoverable failure. */
  FAILED_WITHOUT_CODE: "FailedWithoutCode",
  /** Response without a status, only a message with a correlation ID. */
  UNEXPECTED_FAILURE: "UnexpectedFailure",
});

/**
 * @typedef {object} Operation
 * @property {string} id Operation ID.
 * @property {string} [createdTime] Creation time.
 * @property {string} [lastUpdatedTime] Time of the last state change.
 * @property {OperationStatus} [status] Current state.
 * @property {string|null} [message] Description of the outcome.
 * @property {string|null} [errorCode] Error code if the operation failed.
 * @property {unknown[]|null} [errors] Detailed errors.
 */

/**
 * @typedef {object} EdgeClient
 * @property {(pkg: Blob) => Promise<string>} uploadPackage
 * @property {(operationId: string) => Promise<Operation>} getUploadStatus
 * @property {(operationId: string, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<Operation>} waitForUpload
 * @property {(pkg: Blob, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<Operation>} uploadAndWait
 * @property {(notes?: string) => Promise<string>} publish
 * @property {(operationId: string) => Promise<Operation>} getPublishStatus
 * @property {(operationId: string, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<Operation>} waitForPublish
 * @property {(notes?: string, pollOptions?: import("../lib/poll.js").PollOptions) => Promise<Operation>} publishAndWait
 */

/**
 * Creates a client for one Edge Add-ons product.
 *
 * Release flow: `uploadAndWait()` replaces the product's draft package, then
 * `publishAndWait()` submits the draft for review. If the previous version
 * is still in review, `publishAndWait()` throws a `StoreOperationError` with
 * code `InProgressSubmission`. The API can't cancel it, so retry later.
 *
 * @param {object & import("../lib/http.js").HttpOptions} options
 * @param {string} options.apiKey API key from Partner Center → Publish API.
 *   It expires after 72 days.
 * @param {string} options.clientId Client ID from the same page.
 * @param {string} options.productId Partner Center product ID (a GUID), not
 *   the extension ID shown in the store URL.
 * @param {"text"|"json"} [options.notesFormat="text"] How `publish()` sends
 *   certification notes. The API reference says plain text, while the usage
 *   guide shows JSON `{"notes": …}`. Switch if one is rejected.
 * @returns {EdgeClient} Client bound to that product.
 * @throws {TypeError} If an option is missing or `notesFormat` is invalid.
 */
export function createEdgeClient(options) {
  requireOptions(
    options,
    ["apiKey", "clientId", "productId"],
    "createEdgeClient",
  );
  const { apiKey, clientId, productId, notesFormat = "text" } = options;

  if (notesFormat !== "text" && notesFormat !== "json") {
    throw new TypeError(
      `createEdgeClient: notesFormat must be "text" or "json", got "${notesFormat}"`,
    );
  }

  const httpOptions = pickHttpOptions(options);
  const productUrl = `${API_ROOT}/v1/products/${encodeURIComponent(productId)}`;
  const authorization = {
    Authorization: `ApiKey ${apiKey}`,
    "X-ClientID": clientId,
  };

  async function getOperation(url) {
    const response = await request(url, {
      ...httpOptions,
      headers: authorization,
    });
    return readJson(response);
  }

  function waitForOperation(readOperation, operationId, description, poll) {
    return pollUntil(
      async () => {
        const operation = await readOperation(operationId);

        if (operation?.status === OperationStatus.IN_PROGRESS) {
          return { done: false, value: operation };
        }
        if (operation?.status === OperationStatus.SUCCEEDED) {
          return { done: true, value: operation };
        }

        throw toStoreError(operation, description);
      },
      { description, sleep: httpOptions.sleep, ...poll },
    );
  }

  /**
   * Uploads a package to the product's draft submission. Processing happens
   * in the background; follow it with `waitForUpload()`.
   *
   * @see https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference#upload-a-package-to-update-an-existing-submission
   *
   * @param {Blob} pkg The mv3 zip, e.g. from `fs.openAsBlob(path)`.
   * @returns {Promise<string>} Operation ID of the upload.
   * @throws {import("../lib/errors.js").HttpError} If the upload is rejected,
   *   e.g. HTTP 401 when the API key has expired.
   */
  async function uploadPackage(pkg) {
    const response = await request(`${productUrl}/submissions/draft/package`, {
      ...httpOptions,
      method: "POST",
      // Uploading again only replaces the draft package
      idempotent: true,
      headers: { ...authorization, "Content-Type": "application/zip" },
      body: pkg,
    });
    return operationIdFrom(response);
  }

  /**
   * Reads the state of a package upload.
   *
   * @see https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference#check-the-status-of-a-package-upload
   *
   * @param {string} operationId ID returned by `uploadPackage()`.
   * @returns {Promise<Operation>} Current state.
   * @throws {import("../lib/errors.js").HttpError} If the request fails.
   */
  function getUploadStatus(operationId) {
    return getOperation(
      `${productUrl}/submissions/draft/package/operations/${encodeURIComponent(operationId)}`,
    );
  }

  /**
   * Polls a package upload until it has been processed.
   *
   * @param {string} operationId ID returned by `uploadPackage()`.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing.
   * @returns {Promise<Operation>} The succeeded operation.
   * @throws {StoreOperationError} If the upload failed. `code` holds Edge's
   *   `errorCode`.
   * @throws {import("../lib/errors.js").PollTimeoutError} If processing takes
   *   longer than the timeout.
   */
  function waitForUpload(operationId, pollOptions = {}) {
    return waitForOperation(
      getUploadStatus,
      operationId,
      `Edge package upload ${operationId}`,
      pollOptions,
    );
  }

  /**
   * Uploads a package to the product's draft and waits until Edge has
   * processed it.
   *
   * @param {Blob} pkg The mv3 zip, e.g. from `fs.openAsBlob(path)`.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing for
   *   the wait.
   * @returns {Promise<Operation>} The succeeded upload operation.
   * @throws {StoreOperationError} If the upload failed. `code` holds Edge's
   *   `errorCode`.
   * @throws {import("../lib/errors.js").HttpError} If Edge rejects the
   *   upload, e.g. HTTP 401 when the API key has expired.
   * @throws {import("../lib/errors.js").PollTimeoutError} If processing takes
   *   longer than the timeout.
   */
  async function uploadAndWait(pkg, pollOptions = {}) {
    const operationId = await uploadPackage(pkg);
    return waitForUpload(operationId, pollOptions);
  }

  /**
   * Submits the draft for certification.
   *
   * Not retried after a server error, because the submission may already
   * exist. Edge offers no way to check that through the API, so a failure
   * here needs a look at Partner Center.
   *
   * @see https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference#publish-the-product-draft-submission
   *
   * @param {string} [notes=""] Notes for certification, e.g. build
   *   instructions for reviewers.
   * @returns {Promise<string>} Operation ID of the submission.
   * @throws {import("../lib/errors.js").HttpError} If the request is rejected.
   */
  async function publish(notes = "") {
    const isJson = notesFormat === "json";
    const response = await request(`${productUrl}/submissions`, {
      ...httpOptions,
      method: "POST",
      idempotent: false,
      headers: {
        ...authorization,
        "Content-Type": isJson ? "application/json" : "text/plain",
      },
      body: isJson ? JSON.stringify({ notes }) : notes,
    });
    return operationIdFrom(response);
  }

  /**
   * Reads the state of a submission.
   *
   * @see https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference#check-the-publishing-status
   *
   * @param {string} operationId ID returned by `publish()`.
   * @returns {Promise<Operation>} Current state.
   * @throws {import("../lib/errors.js").HttpError} If the request fails.
   */
  function getPublishStatus(operationId) {
    return getOperation(
      `${productUrl}/submissions/operations/${encodeURIComponent(operationId)}`,
    );
  }

  /**
   * Polls a submission until Edge has accepted it for certification. This
   * doesn't wait for the review itself.
   *
   * @param {string} operationId ID returned by `publish()`.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing.
   * @returns {Promise<Operation>} The succeeded operation.
   * @throws {StoreOperationError} If the submission failed. Code
   *   `InProgressSubmission` means the previous version is still in review.
   * @throws {import("../lib/errors.js").PollTimeoutError} If processing takes
   *   longer than the timeout.
   */
  function waitForPublish(operationId, pollOptions = {}) {
    return waitForOperation(
      getPublishStatus,
      operationId,
      `Edge submission ${operationId}`,
      pollOptions,
    );
  }

  /**
   * Submits the draft for review and waits until Edge has accepted the
   * submission. This doesn't wait for the review itself.
   *
   * @param {string} [notes=""] Notes for certification, e.g. build
   *   instructions for reviewers.
   * @param {import("../lib/poll.js").PollOptions} [pollOptions] Timing for
   *   the wait.
   * @returns {Promise<Operation>} The succeeded submission operation.
   * @throws {StoreOperationError} If the submission failed. Code
   *   `InProgressSubmission` means the previous version is still in review.
   * @throws {import("../lib/errors.js").HttpError} If Edge rejects the
   *   request.
   * @throws {import("../lib/errors.js").PollTimeoutError} If processing takes
   *   longer than the timeout.
   */
  async function publishAndWait(notes = "", pollOptions = {}) {
    const operationId = await publish(notes);
    return waitForPublish(operationId, pollOptions);
  }

  return Object.freeze({
    uploadPackage,
    getUploadStatus,
    waitForUpload,
    uploadAndWait,
    publish,
    getPublishStatus,
    waitForPublish,
    publishAndWait,
  });
}

// The docs show a bare operation ID in the Location header. Taking the last
// path segment also works if it ever holds the full operation URL.
function operationIdFrom(response) {
  const location = response.headers.get("location");
  const operationId = location?.split("/").filter(Boolean).pop();

  if (!operationId) {
    throw new Error("Edge response contains no operation ID in Location");
  }

  return operationId;
}

function toStoreError(operation, description) {
  if (!operation?.status) {
    return new StoreOperationError({
      store: "edge",
      code: ErrorCode.UNEXPECTED_FAILURE,
      message: operation?.message ?? `${description} returned no status`,
      details: operation,
    });
  }

  return new StoreOperationError({
    store: "edge",
    code: operation.errorCode || ErrorCode.FAILED_WITHOUT_CODE,
    message: operation.message ?? `${description} ended as ${operation.status}`,
    details: operation,
  });
}
