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

import { HttpError, PollTimeoutError, StoreOperationError } from "./errors.js";
import { isTransientStatus } from "./http.js";

/**
 * @typedef {object} PollOptions
 * @property {number} [intervalMs=5000] Delay between two checks.
 * @property {number} [timeoutMs=900000] How long to keep polling before
 *   giving up. The default of 15 minutes is enough for every store's upload
 *   and publish processing, but not for a review, which takes days.
 * @property {string} [description="operation"] What is being waited for.
 *   Used in the timeout error.
 * @property {(ms: number) => Promise<void>} [sleep] Waits between checks.
 * @property {() => number} [now=Date.now] Current time in milliseconds.
 */

/**
 * Outcome of one check. While `done` is `false`, `value` is optional and only
 * used to report the last known state if polling times out.
 *
 * @template T
 * @typedef {{done: true, value: T} | {done: false, value?: unknown}} PollResult
 */

/**
 * Calls `check` repeatedly until it reports that it is done, or until the
 * timeout passes.
 *
 * Errors thrown by `check` stop polling and propagate unchanged. That is how
 * wrappers report a store operation that ended in a failure state.
 *
 * @template T
 * @param {() => Promise<PollResult<T>>} check Reads the current state once.
 * @param {PollOptions} [options] Timing options.
 * @returns {Promise<T>} The value of the first result with `done: true`.
 * @throws {PollTimeoutError} If the operation didn't finish within
 *   `timeoutMs`.
 */
export async function pollUntil(check, options = {}) {
  const {
    intervalMs = 5000,
    timeoutMs = 15 * 60 * 1000,
    description = "operation",
    sleep = delay,
    now = Date.now,
  } = options;
  const deadline = now() + timeoutMs;

  for (;;) {
    const result = await check();
    if (result.done) {
      return result.value;
    }

    if (now() + intervalMs > deadline) {
      throw new PollTimeoutError({
        description,
        timeoutMs,
        lastValue: result.value,
      });
    }

    await sleep(intervalMs);
  }
}

/**
 * @typedef {object} RetryStepOptions
 * @property {string} description What the step does, for the log, e.g.
 *   `Uploading Adblock Plus 4.46.0`.
 * @property {string[]} [retryCodes=[]] `StoreOperationError` codes that mean
 *   the store failed without a reason, so trying again can help. Any other
 *   code is final.
 * @property {number} [attempts=10] How often the step runs at most.
 * @property {number} [delayMs=60000] Pause between two attempts.
 * @property {(ms: number) => Promise<void>} [sleep] Waits between attempts.
 * @property {(message: string) => void} [log] Reports failed attempts.
 */

/**
 * Runs a store step, such as uploading a package and waiting until the store
 * has processed it, again when it fails on the store's side. Stores
 * sometimes fail such steps without a reason and succeed on a later
 * attempt.
 *
 * These errors are final and thrown at once:
 * - `HttpError` with a status that `isTransientStatus()` doesn't accept,
 *   e.g. 401 for an expired API key, or 501.
 * - `StoreOperationError` with a code that isn't in `retryCodes`.
 *
 * Anything else is retried: temporary HTTP errors, timeouts while waiting
 * for the store, network errors and unreadable responses. The step should
 * only contain store requests, so mistakes on our side, like a package with
 * the wrong version, are found before it.
 *
 * @template T
 * @param {() => Promise<T>} step The store step.
 * @param {RetryStepOptions} options Retry options.
 * @returns {Promise<T>} The result of the first successful attempt.
 * @throws {Error} The error of the last attempt, or the first final error.
 */
export async function retryStep(step, options) {
  const {
    description,
    retryCodes = [],
    attempts = 10,
    delayMs = 60_000,
    sleep = delay,
    log = console.log, // allow-console
  } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error, retryCodes)) {
        throw error;
      }

      log(
        `${description} failed (attempt ${attempt} of ${attempts}): ` +
          `${error.message}. Trying again in ${delayMs / 1000} s.`,
      );
      await sleep(delayMs);
    }
  }
}

function isRetryable(error, retryCodes) {
  if (error instanceof StoreOperationError) {
    return retryCodes.includes(error.code);
  }
  if (error instanceof HttpError) {
    return isTransientStatus(error.status);
  }
  return true;
}
