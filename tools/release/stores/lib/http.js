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

import { setTimeout as delay } from "timers/promises";

import { HttpError } from "./errors.js";

/**
 * @typedef {object} RetryOptions
 * @property {number} retries Maximum number of retries after the first
 *   attempt.
 * @property {number} minDelayMs Delay before the first retry. It doubles
 *   with every further retry.
 * @property {number} maxDelayMs Upper bound for any delay. If the server asks
 *   for a longer wait through `Retry-After`, the error is thrown instead of
 *   blocking the CI job.
 */

/**
 * Options that control how requests are sent. Every store wrapper passes
 * them on to `request()`. Tests inject `fetchImpl` and `sleep`, so no real
 * HTTP requests or delays happen.
 *
 * @typedef {object} HttpOptions
 * @property {typeof fetch} [fetchImpl=globalThis.fetch] `fetch`
 *   implementation to use.
 * @property {Partial<RetryOptions>} [retry] Overrides for `DEFAULT_RETRY`.
 * @property {(ms: number) => Promise<void>} [sleep] Waits between retries,
 *   and between polls in the clients' `waitFor…()` methods.
 */

/**
 * @typedef {object} RequestOptions
 * @property {string} [method="GET"] HTTP method.
 * @property {Record<string, string>} [headers] Request headers.
 * @property {string|Blob} [body] Request body. It must be re-readable so a
 *   retry can send it again, which rules out streams.
 * @property {boolean} [idempotent] Whether sending the request twice is
 *   safe. Defaults to `true` for GET and `false` otherwise. Requests that
 *   aren't idempotent are only retried on HTTP 429.
 * @property {typeof fetch} [fetchImpl=globalThis.fetch] `fetch`
 *   implementation to use.
 * @property {Partial<RetryOptions>} [retry] Overrides for `DEFAULT_RETRY`.
 * @property {(ms: number) => Promise<void>} [sleep] Waits between retries.
 */

/**
 * Retry settings used unless a caller overrides them.
 *
 * @type {Readonly<RetryOptions>}
 */
export const DEFAULT_RETRY = Object.freeze({
  retries: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
});

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ERROR_BODY_LENGTH = 1000;

/**
 * Returns only the options that control how requests are sent: the `fetch`
 * implementation, the retry settings, and the function that waits between
 * retries and polls. Wrappers pass these on to every request they make, so
 * tests can replace all three in one place.
 *
 * @param {HttpOptions} [options] A wrapper's options, e.g. those of
 *   `uploadToChromeWebStore()`. Other options, such as tokens, are left out.
 * @returns {HttpOptions} Only `fetchImpl`, `retry` and `sleep`.
 */
export function pickHttpOptions({ fetchImpl, retry, sleep } = {}) {
  return { fetchImpl, retry, sleep };
}

/**
 * Sends an HTTP request and retries transient failures.
 *
 * Network errors and HTTP 408, 429, 500, 502, 503 and 504 are retried. Other
 * statuses fail at once. Requests that aren't idempotent, like "publish", are
 * only retried on HTTP 429, because then the server rejected them before
 * doing anything. Any other failure could mean the request already took
 * effect, and the caller should check the store's state instead of sending
 * it again.
 *
 * Delays double after each attempt, starting at `retry.minDelayMs`. A
 * `Retry-After` header from the server takes precedence.
 *
 * @param {string} url Absolute URL to request.
 * @param {RequestOptions} [options] Request and retry options.
 * @returns {Promise<Response>} The first response with a 2xx status.
 * @throws {HttpError} If the last attempt answered with a non-2xx status.
 * @throws {Error} If the last attempt failed with a network error. The
 *   original error is available as `cause`.
 */
export async function request(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    idempotent = method === "GET",
    fetchImpl = globalThis.fetch,
    sleep = delay,
  } = options;
  const retry = { ...DEFAULT_RETRY, ...options.retry };
  const retries = Math.max(0, retry.retries);

  for (let attempt = 0; ; attempt++) {
    const isLastAttempt = attempt >= retries;

    let response;
    try {
      response = await fetchImpl(url, { method, headers, body });
    } catch (error) {
      if (!idempotent || isLastAttempt) {
        throw new Error(`${method} ${url} failed: ${error.message}`, {
          cause: error,
        });
      }
      await sleep(backoffDelay(attempt, retry));
      continue;
    }

    if (response.ok) {
      return response;
    }

    const error = new HttpError({
      method,
      url,
      status: response.status,
      body: await readErrorBody(response),
    });

    if (isLastAttempt || !isRetryableStatus(response.status, idempotent)) {
      throw error;
    }

    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    if (retryAfterMs !== null && retryAfterMs > retry.maxDelayMs) {
      throw error;
    }

    await sleep(retryAfterMs ?? backoffDelay(attempt, retry));
  }
}

/**
 * Parses a response body as JSON.
 *
 * @param {Response} response Response to read.
 * @returns {Promise<any>} The parsed body, or `null` if the body is empty.
 * @throws {Error} If the body isn't valid JSON.
 */
export async function readJson(response) {
  const text = await response.text();
  if (text === "") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected a JSON response but got: ${text.slice(0, 200)}`, {
      cause: error,
    });
  }
}

/**
 * Converts a `Retry-After` header value to a delay in milliseconds.
 *
 * @param {string|null} value Header value, either a number of seconds or an
 *   HTTP date.
 * @param {() => number} [now=Date.now] Current time in milliseconds.
 * @returns {number|null} Milliseconds to wait, or `null` if the header is
 *   missing or can't be parsed.
 */
export function parseRetryAfter(value, now = Date.now) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return null;
  }

  return Math.max(0, date - now());
}

/**
 * Whether an HTTP status usually means "try again later", e.g. throttling or
 * a gateway timeout.
 *
 * @param {number} status HTTP status code.
 * @returns {boolean} `true` for 408, 429, 500, 502, 503 and 504.
 */
export function isTransientStatus(status) {
  return TRANSIENT_STATUSES.has(status);
}

// 429 means the request wasn't processed, so it is safe to retry even for
// requests that aren't idempotent.
function isRetryableStatus(status, idempotent) {
  return status === 429 || (idempotent && isTransientStatus(status));
}

function backoffDelay(attempt, { minDelayMs, maxDelayMs }) {
  return Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
}

async function readErrorBody(response) {
  try {
    const text = await response.text();
    return text.length > MAX_ERROR_BODY_LENGTH
      ? `${text.slice(0, MAX_ERROR_BODY_LENGTH)}…`
      : text;
  } catch (error) {
    return `<unreadable response body: ${error.message}>`;
  }
}
