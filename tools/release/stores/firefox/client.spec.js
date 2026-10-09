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

import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAmoClient, getValidationMessages } from "./client.js";
import { StoreOperationError } from "../lib/errors.js";
import {
  createFakeFetch,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";

const UPLOAD_URL = "https://addons.mozilla.org/api/v5/addons/upload/";
const VERSIONS_URL =
  "https://addons.mozilla.org/api/v5/addons/addon/adblock-plus/versions/";

function createClient(responses) {
  const fetchImpl = createFakeFetch(responses);
  const sleep = vi.fn(async () => {});
  const client = createAmoClient({
    issuer: "user:12345:67",
    secret: "jwt-secret",
    addon: "adblock-plus",
    fetchImpl,
    sleep,
  });
  return { client, fetchImpl, sleep };
}

function uploadResponse(extra = {}) {
  return jsonResponse({ uuid: "u-1", processed: false, ...extra });
}

function validated(extra = {}) {
  return uploadResponse({ processed: true, valid: true, ...extra });
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

function tokenOf(call) {
  return call.headers.Authorization.replace("JWT ", "").split(".");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createAmoClient", () => {
  it("requires an issuer, a secret and an add-on", () => {
    expect(() => createAmoClient({ issuer: "user:1:2" })).toThrow(
      "missing required option(s): secret, addon",
    );
  });

  it("signs requests with an HS256 JWT that expires after a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_700_000_000_000);
    const { client, fetchImpl } = createClient([uploadResponse()]);

    await client.upload(new Blob(["xpi"]));

    const [header, payload, signature] = tokenOf(fetchImpl.calls[0]);
    expect(decodeSegment(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decodeSegment(payload)).toEqual({
      iss: "user:12345:67",
      jti: expect.any(String),
      iat: 1_700_000_000,
      exp: 1_700_000_060,
    });
    expect(signature).toBe(
      createHmac("sha256", "jwt-secret")
        .update(`${header}.${payload}`)
        .digest("base64url"),
    );
  });
});

describe("upload", () => {
  it("posts the package to the listed channel", async () => {
    const { client, fetchImpl } = createClient([uploadResponse()]);
    const pkg = new Blob(["xpi bytes"]);

    const result = await client.upload(pkg);

    expect(result.uuid).toBe("u-1");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(UPLOAD_URL);
    expect(call.method).toBe("POST");
    expect(call.body.get("channel")).toBe("listed");
    expect(await call.body.get("upload").text()).toBe("xpi bytes");
  });

  it("retries the upload after a server error with a fresh token", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("unavailable", { status: 503 }),
      uploadResponse(),
    ]);

    await client.upload(new Blob(["xpi"]));

    const [first, second] = fetchImpl.calls.map(
      (call) => decodeSegment(tokenOf(call)[1]).jti,
    );
    expect(first).not.toBe(second);
  });

  it("doesn't retry an upload the store rejects", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("forbidden", { status: 403 }),
    ]);

    await expect(client.upload(new Blob(["xpi"]))).rejects.toMatchObject({
      name: "HttpError",
      status: 403,
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("uploadAndWait", () => {
  it("polls the upload until it has been validated", async () => {
    const { client, fetchImpl, sleep } = createClient([
      uploadResponse(),
      uploadResponse(),
      validated({ version: "4.46.0" }),
    ]);

    const result = await client.uploadAndWait(new Blob(["xpi"]), {
      intervalMs: 50,
    });

    expect(result.version).toBe("4.46.0");
    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      UPLOAD_URL,
      `${UPLOAD_URL}u-1/`,
      `${UPLOAD_URL}u-1/`,
    ]);
    expect(sleep.mock.calls).toEqual([[50]]);
  });

  it("throws a StoreOperationError when validation fails", async () => {
    const { client } = createClient([
      uploadResponse(),
      validated({
        valid: false,
        validation: {
          messages: [
            { type: "error", message: "Invalid manifest" },
            { type: "warning", message: "Unsafe assignment to innerHTML" },
          ],
        },
      }),
    ]);

    const error = await client
      .uploadAndWait(new Blob(["xpi"]))
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(StoreOperationError);
    expect(error).toMatchObject({
      store: "amo",
      code: "ValidationFailed",
      details: [{ type: "error", message: "Invalid manifest" }],
    });
  });
});

describe("publish", () => {
  it("submits the version for review", async () => {
    const { client, fetchImpl } = createClient([
      jsonResponse({ id: 99, file: { status: "unreviewed" } }, { status: 201 }),
    ]);

    const result = await client.publish("u-1", {
      releaseNotes: "Bug fixes and under-the-hood changes.",
      approvalNotes: "Build with npm ci && npm run build",
      compatibility: ["firefox", "android"],
    });

    expect(result.id).toBe(99);
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(VERSIONS_URL);
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body)).toEqual({
      upload: "u-1",
      release_notes: { "en-US": "Bug fixes and under-the-hood changes." },
      approval_notes: "Build with npm ci && npm run build",
      compatibility: ["firefox", "android"],
    });
  });

  it("doesn't retry publishing after a server error", async () => {
    const { client, fetchImpl } = createClient([
      textResponse("error", { status: 500 }),
    ]);

    await expect(
      client.publish("u-1", {
        releaseNotes: "",
        approvalNotes: "",
        compatibility: ["firefox"],
      }),
    ).rejects.toMatchObject({ name: "HttpError", status: 500 });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("uploadSource", () => {
  it("attaches the source archive to the version", async () => {
    const { client, fetchImpl } = createClient([jsonResponse({ id: 99 })]);

    await client.uploadSource(
      99,
      new Blob(["tar"]),
      "adblockplus-4.46.0.tar.gz",
    );

    const [call] = fetchImpl.calls;
    expect(call.url).toBe(`${VERSIONS_URL}99/`);
    expect(call.method).toBe("PATCH");
    expect(call.body.get("source").name).toBe("adblockplus-4.46.0.tar.gz");
  });
});

describe("getValidationMessages", () => {
  it("returns the messages of one severity", () => {
    const upload = {
      validation: {
        messages: [
          { type: "error", message: "a" },
          { type: "warning", message: "b" },
        ],
      },
    };

    expect(getValidationMessages(upload, "warning")).toEqual([
      { type: "warning", message: "b" },
    ]);
  });

  it("returns an empty list without validation results", () => {
    expect(getValidationMessages({}, "error")).toEqual([]);
  });
});
