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
import { EDGE_SECRETS, getEdgeSecret, loadEdgeProduct } from "./config.js";

const PRODUCT = {
  name: "AdBlock",
  productId: "0f2b8c3e-1111-2222-3333-444455556666",
  clientId: "edge-client-id",
  apiKey: "edge-api-key",
};

function load(product) {
  const fetchImpl = createFakeFetch([
    jsonResponse({
      payload: {
        data: Buffer.from(JSON.stringify(product)).toString("base64"),
      },
    }),
  ]);
  const promise = loadEdgeProduct({
    secret: "edge-adblock-credentials",
    accessToken: "federated-token",
    project: 15970330933,
    fetchImpl,
  });
  return { fetchImpl, promise };
}

describe("getEdgeSecret", () => {
  it("maps both hosts to their secrets", () => {
    expect(EDGE_SECRETS).toEqual({
      adblock: "edge-adblock-credentials",
      adblockplus: "edge-abp-credentials",
    });
    expect(getEdgeSecret("adblock")).toBe("edge-adblock-credentials");
  });

  it("rejects hosts that aren't configured", () => {
    expect(() => getEdgeSecret("ublock")).toThrow(
      'No Edge Add-ons configuration for host "ublock". ' +
        "Known hosts: adblock, adblockplus",
    );
  });
});

describe("loadEdgeProduct", () => {
  it("reads and parses the host's secret", async () => {
    const { fetchImpl, promise } = load(PRODUCT);

    expect(await promise).toEqual(PRODUCT);
    expect(fetchImpl.calls[0].url).toContain(
      "/secrets/edge-adblock-credentials/versions/latest:access",
    );
  });

  it("names a missing API key without showing other values", async () => {
    const { promise } = load({ ...PRODUCT, apiKey: "" });

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret edge-adblock-credentials: missing required option(s): apiKey",
    );
    expect(error.message).not.toContain(PRODUCT.clientId);
  });

  it("rejects a store extension ID in place of the product ID", async () => {
    const { promise } = load({
      ...PRODUCT,
      productId: "ndcileolkflehcjpmjnfbnaibdcgglog",
    });

    const error = await promise.catch((caught) => caught);

    expect(error.message).toBe(
      "Secret edge-adblock-credentials has an invalid productId. Use the " +
        "Partner Center product ID (a GUID), not the store's extension ID.",
    );
    expect(error.message).not.toContain(PRODUCT.apiKey);
  });
});
