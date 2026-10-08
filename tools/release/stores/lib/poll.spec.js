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

import { describe, expect, it, vi } from "vitest";

import { HttpError, PollTimeoutError, StoreOperationError } from "./errors.js";
import { pollUntil, retryStep } from "./poll.js";

function sequence(...results) {
  const queue = [...results];
  return vi.fn(async () => queue.shift());
}

describe("pollUntil", () => {
  it("returns the value as soon as the check reports done", async () => {
    const check = sequence({ done: true, value: 42 });
    const sleep = vi.fn(async () => {});

    expect(await pollUntil(check, { sleep })).toBe(42);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits intervalMs between checks", async () => {
    const check = sequence(
      { done: false },
      { done: false },
      { done: true, value: "ready" },
    );
    const sleep = vi.fn(async () => {});

    expect(await pollUntil(check, { intervalMs: 10, sleep })).toBe("ready");
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [10]]);
  });

  it("throws a PollTimeoutError with the last value once time runs out", async () => {
    let clock = 0;
    const now = () => clock;
    const sleep = vi.fn(async (ms) => {
      clock += ms;
    });
    const check = vi.fn(async () => ({ done: false, value: "IN_PROGRESS" }));

    const error = await pollUntil(check, {
      intervalMs: 10,
      timeoutMs: 25,
      description: "test upload",
      sleep,
      now,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(PollTimeoutError);
    expect(error.message).toBe("Timed out after 25 ms waiting for test upload");
    expect(error.lastValue).toBe("IN_PROGRESS");
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("stops polling when the check throws", async () => {
    const failure = new Error("upload failed");
    const check = vi.fn(async () => {
      throw failure;
    });

    await expect(
      pollUntil(check, { sleep: vi.fn(async () => {}) }),
    ).rejects.toBe(failure);
    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe("retryStep", () => {
  function storeError(code) {
    return new StoreOperationError({ store: "edge", code, message: "failed" });
  }

  function httpError(status) {
    return new HttpError({
      method: "POST",
      url: "https://x",
      status,
      body: "",
    });
  }

  function failingTimes(count, error) {
    let calls = 0;
    return vi.fn(async () => {
      calls++;
      if (calls <= count) {
        throw error;
      }
      return "done";
    });
  }

  function options(overrides = {}) {
    return {
      description: "Uploading Adblock Plus 4.46.0",
      retryCodes: ["FailedWithoutCode"],
      sleep: vi.fn(async () => {}),
      log: vi.fn(),
      ...overrides,
    };
  }

  it("returns the result without waiting when the step succeeds", async () => {
    const step = failingTimes(0);
    const opts = options();

    expect(await retryStep(step, opts)).toBe("done");
    expect(step).toHaveBeenCalledTimes(1);
    expect(opts.sleep).not.toHaveBeenCalled();
  });

  it("tries again after a store failure with a retryable code", async () => {
    const step = failingTimes(2, storeError("FailedWithoutCode"));
    const opts = options();

    expect(await retryStep(step, opts)).toBe("done");
    expect(step).toHaveBeenCalledTimes(3);
    expect(opts.sleep.mock.calls).toEqual([[60_000], [60_000]]);
    expect(opts.log).toHaveBeenCalledWith(
      "Uploading Adblock Plus 4.46.0 failed (attempt 1 of 10): " +
        "[edge] FailedWithoutCode: failed. Trying again in 60 s.",
    );
  });

  it("retries server errors, timeouts and network errors", async () => {
    for (const error of [
      httpError(503),
      httpError(429),
      new PollTimeoutError({ description: "x", timeoutMs: 1 }),
      new Error("POST https://x failed: fetch failed"),
    ]) {
      const step = failingTimes(1, error);

      expect(await retryStep(step, options())).toBe("done");
      expect(step).toHaveBeenCalledTimes(2);
    }
  });

  it("throws final errors at once", async () => {
    for (const error of [
      httpError(401),
      httpError(501),
      storeError("InProgressSubmission"),
    ]) {
      const step = failingTimes(1, error);
      const opts = options();

      await expect(retryStep(step, opts)).rejects.toBe(error);
      expect(step).toHaveBeenCalledTimes(1);
      expect(opts.sleep).not.toHaveBeenCalled();
    }
  });

  it("throws the last error after the last attempt", async () => {
    const error = storeError("FailedWithoutCode");
    const step = failingTimes(Infinity, error);
    const opts = options({ attempts: 3 });

    await expect(retryStep(step, opts)).rejects.toBe(error);
    expect(step).toHaveBeenCalledTimes(3);
    expect(opts.log).toHaveBeenCalledTimes(2);
  });
});
