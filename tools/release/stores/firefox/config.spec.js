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
import { getAmoAddon, loadAmoConfig } from "./config.js";

const CONFIG = {
  issuer: "user:12345:67",
  secret: "jwt-secret",
  addons: {
    adblock: { name: "AdBlock", addon: "adblock-for-firefox", android: false },
    adblockplus: { name: "Adblock Plus", addon: "adblock-plus", android: true },
  },
};

function load(config) {
  const fetchImpl = createFakeFetch([
    jsonResponse({
      payload: { data: Buffer.from(JSON.stringify(config)).toString("base64") },
    }),
  ]);
  const promise = loadAmoConfig({
    accessToken: "federated-token",
    project: 15970330933,
    fetchImpl,
  });
  return { fetchImpl, promise };
}

describe("loadAmoConfig", () => {
  it("reads the shared AMO secret", async () => {
    const { fetchImpl, promise } = load(CONFIG);

    expect(await promise).toEqual(CONFIG);
    expect(fetchImpl.calls[0].url).toContain(
      "/secrets/amo-credentials/versions/latest:access",
    );
  });

  it("rejects an issuer that isn't AMO's JWT issuer", async () => {
    const { promise } = load({ ...CONFIG, issuer: "12345:67" });

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret amo-credentials has an invalid issuer. Copy the JWT issuer " +
        "from AMO's API key page, e.g. user:12345:67.",
    );
    expect(error.message).not.toContain(CONFIG.secret);
  });

  it("names missing fields", async () => {
    const { promise } = load({ issuer: CONFIG.issuer, addons: CONFIG.addons });

    await expect(promise).rejects.toThrow(
      "Secret amo-credentials: missing required option(s): secret",
    );
  });
});

describe("getAmoAddon", () => {
  it("returns the host's add-on", () => {
    expect(getAmoAddon(CONFIG, "adblockplus")).toBe(CONFIG.addons.adblockplus);
  });

  it("accepts android: false as configured", () => {
    expect(getAmoAddon(CONFIG, "adblock").android).toBe(false);
  });

  it("rejects hosts that aren't configured and lists the known ones", () => {
    expect(() => getAmoAddon(CONFIG, "ublock")).toThrow(
      'No Firefox Add-ons configuration for host "ublock". ' +
        "Known hosts: adblock, adblockplus",
    );
  });

  it("rejects an incomplete add-on", () => {
    const config = {
      ...CONFIG,
      addons: { adblock: { name: "AdBlock", android: false } },
    };

    expect(() => getAmoAddon(config, "adblock")).toThrow(
      "AMO configuration (adblock): missing required option(s): addon",
    );
  });

  it("rejects an android flag that isn't a boolean", () => {
    const config = {
      ...CONFIG,
      addons: { adblock: { ...CONFIG.addons.adblock, android: "false" } },
    };

    expect(() => getAmoAddon(config, "adblock")).toThrow(
      "AMO configuration (adblock): android must be true or false",
    );
  });
});
