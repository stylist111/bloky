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

import {
  createFakeFetch,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";
import {
  CHROME_WEB_STORE_SECRETS,
  getChromeWebStoreSecret,
  loadChromeWebStoreProduct,
} from "./config.js";

const PRODUCT = {
  name: "AdBlock",
  publisherId: "80f282fd-35e0-4ffb-bcb9-7f18a30c7d7c",
  itemId: "gighmmpiobklfepjocnamgkkbiglidom",
  serviceAccountEmail: "cws-adblock@eyeo-extensions.iam.gserviceaccount.com",
};

function secretResponse(value) {
  return jsonResponse({
    payload: { data: Buffer.from(value).toString("base64") },
  });
}

function load(responses) {
  const fetchImpl = createFakeFetch(responses);
  const promise = loadChromeWebStoreProduct({
    secret: "cws-adblock-credentials",
    accessToken: "federated-token",
    project: 15970330933,
    fetchImpl,
  });
  return { fetchImpl, promise };
}

describe("getChromeWebStoreSecret", () => {
  it("maps both hosts to their secrets", () => {
    expect(CHROME_WEB_STORE_SECRETS).toEqual({
      adblock: "cws-adblock-credentials",
      adblockplus: "cws-abp-credentials",
    });
    expect(getChromeWebStoreSecret("adblockplus")).toBe("cws-abp-credentials");
  });

  it("rejects hosts that aren't configured and lists the known ones", () => {
    expect(() => getChromeWebStoreSecret("ublock")).toThrow(
      'No Chrome Web Store configuration for host "ublock". ' +
        "Known hosts: adblock, adblockplus",
    );
  });

  it("doesn't treat inherited properties as hosts", () => {
    expect(() => getChromeWebStoreSecret("toString")).toThrow(
      'No Chrome Web Store configuration for host "toString"',
    );
  });
});

describe("loadChromeWebStoreProduct", () => {
  it("reads and parses the host's secret", async () => {
    const { fetchImpl, promise } = load([
      secretResponse(JSON.stringify(PRODUCT)),
    ]);

    expect(await promise).toEqual(PRODUCT);
    expect(fetchImpl.calls[0].url).toBe(
      "https://secretmanager.googleapis.com/v1/projects/15970330933" +
        "/secrets/cws-adblock-credentials/versions/latest:access",
    );
    expect(fetchImpl.calls[0].headers.Authorization).toBe(
      "Bearer federated-token",
    );
  });

  it("rejects secrets that aren't JSON without showing their value", async () => {
    const { promise } = load([secretResponse("publisherId=hunter2")]);

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret cws-adblock-credentials doesn't contain valid JSON",
    );
    expect(error.message).not.toContain("hunter2");
  });

  it("rejects an incomplete configuration", async () => {
    const { promise } = load([
      secretResponse(JSON.stringify({ ...PRODUCT, publisherId: "" })),
    ]);

    await expect(promise).rejects.toThrow(
      "Secret cws-adblock-credentials: missing required option(s): publisherId",
    );
  });

  it("rejects an invalid extension ID", async () => {
    const { promise } = load([
      secretResponse(JSON.stringify({ ...PRODUCT, itemId: "not-an-id" })),
    ]);

    await expect(promise).rejects.toThrow(
      "Secret cws-adblock-credentials has an invalid itemId",
    );
  });

  it("passes on a denied read without retrying", async () => {
    const { fetchImpl, promise } = load([
      textResponse("Permission denied", { status: 403 }),
    ]);

    await expect(promise).rejects.toMatchObject({
      name: "HttpError",
      status: 403,
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});
