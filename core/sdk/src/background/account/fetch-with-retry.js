/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import sentry from "../sentry.js";
import {sleep} from "../../all/helpers.js";
import {
  UnauthorizedError,
  ClientError,
  ServerError,
  MaxRetryError,
  RateLimitError
} from "./errors.js";

/**
 * Fetch wrapper with retry and structured error handling.
 * Retries by default 3 times on network errors and server errors (5xx),
 * using exponential backoff between attempts (e.g. 500ms, 1000ms, 2000ms).
 *
 * @param {Object} config - Configuration object
 * @param {string} config.url - The URL to fetch
 * @param {RequestInit} [config.options={}] - Fetch API options
 *   (method, headers, body, etc.)
 * @param {number} [config.maxRetries=3] - How many times to retry on failure
 * @param {number} [config.errorRetryDelay=1000] - Initial delay (in ms)
 * @returns {Promise<Object>} - Resolves with successful Response
 * @throws {
 *   UnauthorizedError|ClientError|ServerError|NetworkError|MaxRetryError
 * }
 */
export async function fetchWithRetry({
  url,
  options = {},
  maxRetries = 3,
  errorRetryDelay = 500
}) {
  let attempt = 0;

  const defaultHeaders = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const finalOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, finalOptions);
      const parsedResponse = await response.json();

      if (response.ok) {
        return parsedResponse;
      }

      const {status} = response;

      if (status === 401) {
        throw new UnauthorizedError(url, status, parsedResponse);
      }
      else if (status === 429) {
        throw new RateLimitError(url, status, parsedResponse);
      }
      else if (status >= 400 && status < 500) {
        throw new ClientError(url, status, parsedResponse);
      }
      else if (status >= 500) {
        throw new ServerError(url, status, parsedResponse);
      }
    }
    catch (err) {
      const isNetworkError = err instanceof TypeError;
      const isServerError = err instanceof ServerError;

      // If we reach the max retry attempts, throw a MaxRetryError
      if (attempt >= maxRetries) {
        throw new MaxRetryError(url, err);
      }

      // Retry on network errors or server errors
      if (isNetworkError || isServerError) {
        const exponentialDelay = errorRetryDelay * (1 << attempt);
        attempt++;
        await sleep(exponentialDelay);

        // Log the error to Sentry if it's a server error
        if (isServerError) {
          sentry.reportError(err);
        }

        continue;
      }

      // Rethrow non-retryable errors
      throw err;
    }
  }
}
