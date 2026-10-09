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

import {
  createFakeFetch,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";
import { HttpError } from "./errors.js";
import { parseRetryAfter, pickHttpOptions, readJson, request } from "./http.js";

const URL = "https://store.example/api/items";

function noSleep() {
  return vi.fn(async () => {});
}

describe("request", () => {
  it("returns the first successful response without retrying", async () => {
    const fetchImpl = createFakeFetch([jsonResponse({ ok: true })]);
    const sleep = noSleep();

    const response = await request(URL, { fetchImpl, sleep });

    expect(await response.json()).toEqual({ ok: true });
    expect(fetchImpl.calls).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries transient server errors with exponential backoff", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("unavailable", { status: 503 }),
      textResponse("bad gateway", { status: 502 }),
      jsonResponse({}),
    ]);
    const sleep = noSleep();

    await request(URL, { fetchImpl, sleep, retry: { minDelayMs: 100 } });

    expect(fetchImpl.calls).toHaveLength(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it("waits as long as Retry-After asks", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("throttled", {
        status: 429,
        headers: { "Retry-After": "2" },
      }),
      jsonResponse({}),
    ]);
    const sleep = noSleep();

    await request(URL, { fetchImpl, sleep });

    expect(sleep.mock.calls).toEqual([[2000]]);
  });

  it("throws instead of waiting when Retry-After exceeds maxDelayMs", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("throttled for an hour", {
        status: 429,
        headers: { "Retry-After": "3600" },
      }),
    ]);

    await expect(
      request(URL, { fetchImpl, sleep: noSleep() }),
    ).rejects.toMatchObject({ name: "HttpError", status: 429 });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("doesn't retry client errors", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("invalid package", { status: 400 }),
    ]);

    const error = await request(URL, { fetchImpl, sleep: noSleep() }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      method: "GET",
      url: URL,
      status: 400,
      body: "invalid package",
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("gives up after the configured number of retries", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("error", { status: 500 }),
      textResponse("error", { status: 500 }),
      textResponse("error", { status: 500 }),
    ]);

    await expect(
      request(URL, { fetchImpl, sleep: noSleep(), retry: { retries: 2 } }),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl.calls).toHaveLength(3);
  });

  it("doesn't retry server errors for requests that aren't idempotent", async () => {
    const fetchImpl = createFakeFetch([textResponse("error", { status: 500 })]);

    await expect(
      request(URL, { method: "POST", fetchImpl, sleep: noSleep() }),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("retries HTTP 429 even for requests that aren't idempotent", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("throttled", { status: 429 }),
      jsonResponse({}),
    ]);

    await request(URL, { method: "POST", fetchImpl, sleep: noSleep() });

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("retries network errors for idempotent requests", async () => {
    const fetchImpl = createFakeFetch([
      new TypeError("fetch failed"),
      jsonResponse({}),
    ]);

    await request(URL, { fetchImpl, sleep: noSleep() });

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("doesn't retry network errors for requests that aren't idempotent", async () => {
    const networkError = new TypeError("fetch failed");
    const fetchImpl = createFakeFetch([networkError]);

    const error = await request(URL, {
      method: "POST",
      fetchImpl,
      sleep: noSleep(),
    }).catch((caught) => caught);

    expect(error.message).toBe(`POST ${URL} failed: fetch failed`);
    expect(error.cause).toBe(networkError);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("builds headers before every attempt when given a function", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("unavailable", { status: 503 }),
      jsonResponse({}),
    ]);
    let attempt = 0;
    const headers = () => ({ Authorization: `JWT token-${attempt++}` });

    await request(URL, { headers, fetchImpl, sleep: noSleep() });

    expect(fetchImpl.calls.map((call) => call.headers.Authorization)).toEqual([
      "JWT token-0",
      "JWT token-1",
    ]);
  });

  it("truncates long error bodies", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("x".repeat(5000), { status: 400 }),
    ]);

    const error = await request(URL, { fetchImpl, sleep: noSleep() }).catch(
      (caught) => caught,
    );

    expect(error.body).toHaveLength(1001);
    expect(error.body.endsWith("…")).toBe(true);
  });
});

describe("parseRetryAfter", () => {
  it("reads delays in seconds", () => {
    expect(parseRetryAfter("5")).toBe(5000);
  });

  it("reads HTTP dates relative to now", () => {
    const value = new Date(10_000).toUTCString();

    expect(parseRetryAfter(value, () => 4000)).toBe(6000);
  });

  it("never returns a negative delay", () => {
    const value = new Date(1000).toUTCString();

    expect(parseRetryAfter(value, () => 5000)).toBe(0);
  });

  it("returns null for missing or invalid values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});

describe("readJson", () => {
  it("parses JSON bodies", async () => {
    expect(await readJson(jsonResponse({ id: 1 }))).toEqual({ id: 1 });
  });

  it("returns null for empty bodies", async () => {
    expect(await readJson(textResponse(""))).toBeNull();
  });

  it("throws on bodies that aren't JSON", async () => {
    await expect(readJson(textResponse("<html>"))).rejects.toThrow(
      "Expected a JSON response but got: <html>",
    );
  });
});

describe("pickHttpOptions", () => {
  it("keeps only the HTTP options", () => {
    const fetchImpl = vi.fn();
    const sleep = vi.fn();

    expect(
      pickHttpOptions({ fetchImpl, sleep, retry: { retries: 1 }, apiKey: "k" }),
    ).toEqual({ fetchImpl, sleep, retry: { retries: 1 } });
  });
});
