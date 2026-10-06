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

/**
 * Thrown when a store API answers with a non-2xx HTTP status.
 *
 * The message never contains request headers, so credentials sent in
 * `Authorization` headers don't end up in CI logs.
 */
export class HttpError extends Error {
  /**
   * @param {object} details
   * @param {string} details.method HTTP method of the failed request.
   * @param {string} details.url URL of the failed request.
   * @param {number} details.status HTTP status code of the response.
   * @param {string} details.body Response body, truncated for readability.
   */
  constructor({ method, url, status, body }) {
    super(`${method} ${url} failed with HTTP ${status}: ${body}`);
    this.name = "HttpError";
    this.method = method;
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown when a store accepted a request but reports that the operation
 * itself failed, e.g. a Chrome Web Store upload that ended in state
 * `FAILED`.
 */
export class StoreOperationError extends Error {
  /**
   * @param {object} details
   * @param {string} details.store Store that reported the failure, e.g.
   *   `chrome-web-store`.
   * @param {string} details.code Store-specific error code or state, e.g.
   *   `FAILED`.
   * @param {string} details.message Human-readable description.
   * @param {unknown} [details.details] Raw data from the store response, for
   *   logging and debugging.
   */
  constructor({ store, code, message, details }) {
    super(`[${store}] ${code}: ${message}`);
    this.name = "StoreOperationError";
    this.store = store;
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown by `pollUntil()` when an operation doesn't finish in time.
 */
export class PollTimeoutError extends Error {
  /**
   * @param {object} details
   * @param {string} details.description What was being waited for, e.g.
   *   `Chrome Web Store upload for cfhdojbkjhnklbpkdaibdccddilifddb`.
   * @param {number} details.timeoutMs How long polling lasted.
   * @param {unknown} details.lastValue The last value the check returned,
   *   to show the state the operation was stuck in.
   */
  constructor({ description, timeoutMs, lastValue }) {
    super(`Timed out after ${timeoutMs} ms waiting for ${description}`);
    this.name = "PollTimeoutError";
    this.timeoutMs = timeoutMs;
    this.lastValue = lastValue;
  }
}
