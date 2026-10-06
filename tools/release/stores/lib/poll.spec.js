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

import { PollTimeoutError } from "./errors.js";
import { pollUntil } from "./poll.js";

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
