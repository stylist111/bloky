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

import { ErrorCode, OperationStatus, createEdgeClient } from "./client.js";
import { StoreOperationError } from "../lib/errors.js";
import {
  createFakeFetch,
  emptyResponse,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";

const PRODUCT_ID = "0f2b8c3e-1111-2222-3333-444455556666";
const PRODUCT_URL = `https://api.addons.microsoftedge.microsoft.com/v1/products/${PRODUCT_ID}`;
const AUTH_HEADERS = {
  Authorization: "ApiKey edge-api-key",
  "X-ClientID": "edge-client-id",
};

function createClient(responses, options = {}) {
  const fetchImpl = createFakeFetch(responses);
  const sleep = vi.fn(async () => {});
  const client = createEdgeClient({
    apiKey: "edge-api-key",
    clientId: "edge-client-id",
    productId: PRODUCT_ID,
    fetchImpl,
    sleep,
    ...options,
  });
  return { client, fetchImpl, sleep };
}

function accepted(operationId) {
  return emptyResponse({ status: 202, headers: { Location: operationId } });
}

function operation(status, extra = {}) {
  return jsonResponse({
    id: "op-1",
    createdTime: "2026-10-01T10:00:00Z",
    lastUpdatedTime: "2026-10-01T10:00:05Z",
    status,
    message: null,
    errorCode: null,
    errors: null,
    ...extra,
  });
}

describe("createEdgeClient", () => {
  it("requires an API key, client ID and product ID", () => {
    expect(() => createEdgeClient({ apiKey: "k" })).toThrow(
      "missing required option(s): clientId, productId",
    );
  });

  it("rejects unknown notes formats", () => {
    expect(() =>
      createEdgeClient({
        apiKey: "k",
        clientId: "c",
        productId: "p",
        notesFormat: "xml",
      }),
    ).toThrow('notesFormat must be "text" or "json"');
  });
});

describe("uploadPackage", () => {
  it("uploads the zip and returns the operation ID", async () => {
    const { client, fetchImpl } = createClient([accepted("op-1")]);
    const pkg = new Blob(["zip bytes"]);

    expect(await client.uploadPackage(pkg)).toBe("op-1");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(`${PRODUCT_URL}/submissions/draft/package`);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({
      ...AUTH_HEADERS,
      "Content-Type": "application/zip",
    });
    expect(call.body).toBe(pkg);
  });

  it("accepts a Location header that holds the full operation URL", async () => {
    const { client } = createClient([
      accepted(`${PRODUCT_URL}/submissions/draft/package/operations/op-2`),
    ]);

    expect(await client.uploadPackage(new Blob(["zip"]))).toBe("op-2");
  });

  it("fails when the response has no Location header", async () => {
    const { client } = createClient([emptyResponse({ status: 202 })]);

    await expect(client.uploadPackage(new Blob(["zip"]))).rejects.toThrow(
      "no operation ID in Location",
    );
  });

  it("reports an expired API key as HTTP 401 without retrying", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("Unauthorized", { status: 401 }),
    ]);

    await expect(client.uploadPackage(new Blob(["zip"]))).rejects.toMatchObject(
      { name: "HttpError", status: 401 },
    );
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("waitForUpload", () => {
  it("polls the upload operation until it succeeds", async () => {
    const { client, fetchImpl, sleep } = createClient([
      operation(OperationStatus.IN_PROGRESS),
      operation(OperationStatus.SUCCEEDED, {
        message: "Successfully updated package to adblockplus.zip",
      }),
    ]);

    const result = await client.waitForUpload("op-1", { intervalMs: 20 });

    expect(result.status).toBe(OperationStatus.SUCCEEDED);
    expect(fetchImpl.calls[0]).toMatchObject({
      url: `${PRODUCT_URL}/submissions/draft/package/operations/op-1`,
      method: "GET",
      headers: AUTH_HEADERS,
    });
    expect(sleep.mock.calls).toEqual([[20]]);
  });

  it("throws a StoreOperationError when processing fails", async () => {
    const { client } = createClient([
      operation(OperationStatus.FAILED, {
        message: "Package is invalid",
        errorCode: "InvalidPackage",
        errors: ["manifest.json missing"],
      }),
    ]);

    const error = await client.waitForUpload("op-1").catch((caught) => caught);

    expect(error).toBeInstanceOf(StoreOperationError);
    expect(error).toMatchObject({ store: "edge", code: "InvalidPackage" });
    expect(error.details.errors).toEqual(["manifest.json missing"]);
  });
});

describe("publish", () => {
  it("sends the certification notes as plain text by default", async () => {
    const { client, fetchImpl } = createClient([accepted("op-3")]);

    expect(await client.publish("Build with npm ci")).toBe("op-3");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(`${PRODUCT_URL}/submissions`);
    expect(call.method).toBe("POST");
    expect(call.headers["Content-Type"]).toBe("text/plain");
    expect(call.body).toBe("Build with npm ci");
  });

  it("sends JSON notes when configured", async () => {
    const { client, fetchImpl } = createClient([accepted("op-3")], {
      notesFormat: "json",
    });

    await client.publish("Build with npm ci");

    expect(fetchImpl.calls[0].headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(fetchImpl.calls[0].body)).toEqual({
      notes: "Build with npm ci",
    });
  });

  it("doesn't retry publishing after a server error", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("error", { status: 500 }),
    ]);

    await expect(client.publish()).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("waitForPublish", () => {
  it("returns the operation once the submission is accepted", async () => {
    const { client, fetchImpl } = createClient([
      operation(OperationStatus.SUCCEEDED),
    ]);

    const result = await client.waitForPublish("op-3");

    expect(result.status).toBe(OperationStatus.SUCCEEDED);
    expect(fetchImpl.calls[0].url).toBe(
      `${PRODUCT_URL}/submissions/operations/op-3`,
    );
  });

  it("reports a previous version that is still in review", async () => {
    const { client } = createClient([
      operation(OperationStatus.FAILED, {
        message:
          "Can't publish extension as your extension submission is in progress.",
        errorCode: "InProgressSubmission",
      }),
    ]);

    await expect(client.waitForPublish("op-3")).rejects.toMatchObject({
      code: ErrorCode.IN_PROGRESS_SUBMISSION,
    });
  });

  it("labels failures without an error code", async () => {
    const { client } = createClient([
      operation(OperationStatus.FAILED, {
        message: "An error occurred while performing the operation",
      }),
    ]);

    await expect(client.waitForPublish("op-3")).rejects.toMatchObject({
      code: ErrorCode.FAILED_WITHOUT_CODE,
    });
  });

  it("treats a response without a status as an unexpected failure", async () => {
    const { client } = createClient([
      jsonResponse({
        id: "op-3",
        message:
          "An error occurred while processing the request. Please contact support Correlation ID: op-3",
      }),
    ]);

    const error = await client.waitForPublish("op-3").catch((caught) => caught);

    expect(error.code).toBe(ErrorCode.UNEXPECTED_FAILURE);
    expect(error.message).toContain("Correlation ID: op-3");
  });
});
