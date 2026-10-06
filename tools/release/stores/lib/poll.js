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

import { PollTimeoutError } from "./errors.js";

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
