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

import { UploadState, createChromeWebStoreClient } from "./client.js";
import { StoreOperationError } from "../lib/errors.js";
import {
  createFakeFetch,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";

const ITEM_ID = "cfhdojbkjhnklbpkdaibdccddilifddb";
const NAME = `publishers/pub-123/items/${ITEM_ID}`;
const ITEM_URL = `https://chromewebstore.googleapis.com/v2/${NAME}`;
const UPLOAD_URL = `https://chromewebstore.googleapis.com/upload/v2/${NAME}:upload`;

function createClient(responses) {
  const fetchImpl = createFakeFetch(responses);
  const sleep = vi.fn(async () => {});
  const client = createChromeWebStoreClient({
    accessToken: "cws-token",
    publisherId: "pub-123",
    itemId: ITEM_ID,
    fetchImpl,
    sleep,
  });
  return { client, fetchImpl, sleep };
}

function uploadResponse(uploadState, crxVersion) {
  return jsonResponse({ name: NAME, itemId: ITEM_ID, crxVersion, uploadState });
}

function statusResponse(lastAsyncUploadState) {
  return jsonResponse({ name: NAME, itemId: ITEM_ID, lastAsyncUploadState });
}

describe("createChromeWebStoreClient", () => {
  it("requires a token, publisher and item", () => {
    expect(() => createChromeWebStoreClient({ accessToken: "t" })).toThrow(
      "missing required option(s): publisherId, itemId",
    );
  });
});

describe("upload", () => {
  it("posts the package to the upload endpoint", async () => {
    const { client, fetchImpl } = createClient([
      uploadResponse(UploadState.SUCCEEDED, "4.46.0"),
    ]);
    const pkg = new Blob(["zip bytes"]);

    const result = await client.upload(pkg);

    expect(result).toMatchObject({
      uploadState: "SUCCEEDED",
      crxVersion: "4.46.0",
    });
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(UPLOAD_URL);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({
      Authorization: "Bearer cws-token",
      "Content-Type": "application/zip",
    });
    expect(call.body).toBe(pkg);
  });

  it("retries the upload after a server error", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("unavailable", { status: 503 }),
      uploadResponse(UploadState.SUCCEEDED),
    ]);

    await client.upload(new Blob(["zip"]));

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("doesn't retry an upload the store rejects", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("forbidden", { status: 403 }),
    ]);

    await expect(client.upload(new Blob(["zip"]))).rejects.toMatchObject({
      name: "HttpError",
      status: 403,
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("uploadAndWait", () => {
  it("returns at once when the upload finished synchronously", async () => {
    const { client, fetchImpl } = createClient([
      uploadResponse(UploadState.SUCCEEDED, "4.46.0"),
    ]);

    const result = await client.uploadAndWait(new Blob(["zip"]));

    expect(result.uploadState).toBe(UploadState.SUCCEEDED);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("polls the item status while the upload is in progress", async () => {
    const { client, fetchImpl, sleep } = createClient([
      uploadResponse(UploadState.IN_PROGRESS),
      statusResponse(UploadState.IN_PROGRESS),
      statusResponse(UploadState.SUCCEEDED),
    ]);

    const result = await client.uploadAndWait(new Blob(["zip"]), {
      intervalMs: 50,
    });

    expect(result.uploadState).toBe(UploadState.SUCCEEDED);
    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      UPLOAD_URL,
      `${ITEM_URL}:fetchStatus`,
      `${ITEM_URL}:fetchStatus`,
    ]);
    expect(fetchImpl.calls[1].headers.Authorization).toBe("Bearer cws-token");
    expect(sleep.mock.calls).toEqual([[50]]);
  });

  it("throws a StoreOperationError when the upload fails", async () => {
    const { client } = createClient([uploadResponse(UploadState.FAILED)]);

    const error = await client
      .uploadAndWait(new Blob(["zip"]))
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(StoreOperationError);
    expect(error).toMatchObject({ store: "chrome-web-store", code: "FAILED" });
  });

  it("throws when the background processing fails", async () => {
    const { client } = createClient([
      uploadResponse(UploadState.IN_PROGRESS),
      statusResponse(UploadState.FAILED),
    ]);

    await expect(client.uploadAndWait(new Blob(["zip"]))).rejects.toMatchObject(
      { code: "FAILED" },
    );
  });
});

describe("publish", () => {
  it("submits the draft for review", async () => {
    const { client, fetchImpl } = createClient([
      jsonResponse({ name: NAME, itemId: ITEM_ID, state: "PENDING_REVIEW" }),
    ]);

    const result = await client.publish();

    expect(result.state).toBe("PENDING_REVIEW");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(`${ITEM_URL}:publish`);
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body)).toEqual({ publishType: "DEFAULT_PUBLISH" });
  });

  it("doesn't retry publishing after a server error", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("error", { status: 500 }),
    ]);

    await expect(client.publish()).rejects.toMatchObject({
      name: "HttpError",
      status: 500,
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("fails when the store answers without a state", async () => {
    for (const response of [textResponse(""), jsonResponse({ name: NAME })]) {
      const { client, fetchImpl } = createClient([response]);

      const error = await client.publish().catch((caught) => caught);

      expect(error).toBeInstanceOf(StoreOperationError);
      expect(error).toMatchObject({
        store: "chrome-web-store",
        code: "UNKNOWN",
      });
      expect(error.message).toContain(
        "Check in the Developer Dashboard whether it was submitted.",
      );
      expect(fetchImpl.calls).toHaveLength(1);
    }
  });
});
