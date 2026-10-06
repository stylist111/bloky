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

import { describe, expect, it } from "vitest";

import { createFakeFetch, jsonResponse } from "../test/fake-fetch.js";
import { getHostSecret, loadConfigSecret } from "./config-secret.js";

const SECRETS = { adblock: "store-adblock", adblockplus: "store-abp" };

function secretResponse(value) {
  return jsonResponse({
    payload: { data: Buffer.from(value).toString("base64") },
  });
}

function load(value, fields = ["name", "apiKey"]) {
  const fetchImpl = createFakeFetch([secretResponse(value)]);
  const promise = loadConfigSecret({
    secret: "store-adblock",
    accessToken: "federated-token",
    project: 15970330933,
    fields,
    fetchImpl,
  });
  return { fetchImpl, promise };
}

describe("getHostSecret", () => {
  it("returns the host's secret", () => {
    expect(getHostSecret("adblockplus", SECRETS, "Test Store")).toBe(
      "store-abp",
    );
  });

  it("names the store and the known hosts for unknown hosts", () => {
    expect(() => getHostSecret("ublock", SECRETS, "Test Store")).toThrow(
      'No Test Store configuration for host "ublock". ' +
        "Known hosts: adblock, adblockplus",
    );
  });

  it("doesn't treat inherited properties as hosts", () => {
    expect(() => getHostSecret("toString", SECRETS, "Test Store")).toThrow(
      'No Test Store configuration for host "toString"',
    );
  });
});

describe("loadConfigSecret", () => {
  it("reads and parses the secret", async () => {
    const { fetchImpl, promise } = load('{"name":"AdBlock","apiKey":"k"}');

    expect(await promise).toEqual({ name: "AdBlock", apiKey: "k" });
    expect(fetchImpl.calls[0].url).toBe(
      "https://secretmanager.googleapis.com/v1/projects/15970330933" +
        "/secrets/store-adblock/versions/latest:access",
    );
  });

  it("rejects values that aren't JSON without showing them", async () => {
    const { promise } = load("not-json-hunter2");

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret store-adblock doesn't contain valid JSON",
    );
    expect(error.message).not.toContain("hunter2");
  });

  it("names missing fields without showing the others", async () => {
    const { promise } = load(
      '{"name":"AdBlock","apiKey":"","other":"hunter2"}',
    );

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret store-adblock: missing required option(s): apiKey",
    );
    expect(error.message).not.toContain("hunter2");
  });
});
