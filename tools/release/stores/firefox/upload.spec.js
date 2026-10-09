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
import { findUnexpectedWarnings, uploadToAmo } from "./upload.js";

const API = "https://addons.mozilla.org/api/v5/addons";
const UPLOAD_URL = `${API}/upload/`;
const VERSIONS_URL = `${API}/addon/adblock-plus/versions/`;
const PACKAGE_PATH =
  "/repo/host/adblockplus/dist/release/adblockplus-firefox-4.46.0-mv2.xpi";
const SOURCE_PATH =
  "/repo/host/adblockplus/dist/release/adblockplus-4.46.0.tar.gz";
const CONFIG = {
  issuer: "user:12345:67",
  secret: "jwt-secret",
  addons: {
    adblock: { name: "AdBlock", addon: "adblock-for-firefox", android: false },
    adblockplus: { name: "Adblock Plus", addon: "adblock-plus", android: true },
  },
};

function secretResponse(config) {
  return jsonResponse({
    payload: { data: Buffer.from(JSON.stringify(config)).toString("base64") },
  });
}

// STS exchange and configuration secret
const AUTH_RESPONSES = () => [
  jsonResponse({ access_token: "federated-token" }),
  secretResponse(CONFIG),
];

function uploadResponse(extra = {}) {
  return jsonResponse({ uuid: "upload-1", processed: false, ...extra });
}

function validated(extra = {}) {
  return uploadResponse({
    processed: true,
    valid: true,
    version: "4.46.0",
    validation: {
      messages: [
        { type: "warning", message: "Unsafe assignment to innerHTML" },
      ],
    },
    ...extra,
  });
}

// A server error on the first try and on all three request retries
function unavailable() {
  return Array.from({ length: 4 }, () =>
    textResponse("unavailable", { status: 503 }),
  );
}

function setup(responses, overrides = {}) {
  const fetchImpl = createFakeFetch(responses);
  const files = {
    [PACKAGE_PATH]: new Blob(["xpi bytes"]),
    [SOURCE_PATH]: new Blob(["tar bytes"]),
  };
  const readPackage = vi.fn(async (file) => files[file]);
  const readVersion = vi.fn(async () => "4.46.0");
  const readNotes = vi.fn(async () => "- Fixed a crash on start");
  const readNotesForReviewers = vi.fn(async () => "Build with npm ci");
  const log = vi.fn();

  const run = () =>
    uploadToAmo({
      host: "adblockplus",
      version: "4.46.0",
      idToken: "gitlab-id-token",
      audience:
        "//iam.googleapis.com/projects/15970330933/locations/global/workloadIdentityPools/gitlab/providers/gitlab-com",
      project: "15970330933",
      rootPath: "/repo",
      readVersion,
      readPackage,
      readNotes,
      readNotesForReviewers,
      log,
      fetchImpl,
      sleep: vi.fn(async () => {}),
      ...overrides,
    });

  return { fetchImpl, files, readPackage, readVersion, log, run };
}

describe("uploadToAmo", () => {
  it("uploads the host's package and submits it for review", async () => {
    const { fetchImpl, files, readVersion, readPackage, log, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated(),
      jsonResponse({ id: 99 }, { status: 201 }),
      jsonResponse({ id: 99, file: { status: "unreviewed" } }),
    ]);

    const result = await run();

    expect(result.version.file.status).toBe("unreviewed");
    expect(readVersion).toHaveBeenCalledWith(PACKAGE_PATH);
    expect(readPackage).toHaveBeenCalledWith(PACKAGE_PATH);
    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      "https://sts.googleapis.com/v1/token",
      expect.stringContaining("/secrets/amo-credentials/"),
      UPLOAD_URL,
      `${UPLOAD_URL}upload-1/`,
      VERSIONS_URL,
      `${VERSIONS_URL}99/`,
    ]);

    const [, , uploadCall, , versionCall, sourceCall] = fetchImpl.calls;
    expect(uploadCall.headers.Authorization).toMatch(/^JWT /);
    expect(await uploadCall.body.get("upload").text()).toBe(
      await files[PACKAGE_PATH].text(),
    );
    expect(JSON.parse(versionCall.body)).toEqual({
      upload: "upload-1",
      release_notes: { "en-US": "- Fixed a crash on start" },
      approval_notes: "Build with npm ci",
      compatibility: ["firefox", "android"],
    });
    expect(sourceCall.body.get("source").name).toBe(
      "adblockplus-4.46.0.tar.gz",
    );
    expect(log).toHaveBeenLastCalledWith(
      "Submitted Adblock Plus 4.46.0 for review with its source code " +
        "(file status: unreviewed)",
    );
  });

  it("marks hosts without Android support as desktop only", async () => {
    const adblockFiles = {
      "/repo/host/adblock/dist/release/adblock-firefox-6.48.0-mv2.xpi":
        new Blob(["xpi"]),
      "/repo/host/adblock/dist/release/adblock-6.48.0.tar.gz": new Blob([
        "tar",
      ]),
    };
    const { fetchImpl, run } = setup(
      [
        ...AUTH_RESPONSES(),
        uploadResponse(),
        validated({ version: "6.48.0" }),
        jsonResponse({ id: 7 }),
        jsonResponse({ id: 7 }),
      ],
      {
        host: "adblock",
        version: "6.48.0",
        readVersion: vi.fn(async () => "6.48.0"),
        readPackage: vi.fn(async (file) => adblockFiles[file]),
      },
    );

    await run();

    expect(fetchImpl.calls[4].url).toBe(
      `${API}/addon/adblock-for-firefox/versions/`,
    );
    expect(JSON.parse(fetchImpl.calls[4].body).compatibility).toEqual([
      "firefox",
    ]);
  });

  it("uploads again when the store fails to process the package", async () => {
    const { fetchImpl, log, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      ...unavailable(),
      uploadResponse({ uuid: "upload-2" }),
      validated({ uuid: "upload-2" }),
      jsonResponse({ id: 99 }),
      jsonResponse({ id: 99 }),
    ]);

    await run();

    expect(
      fetchImpl.calls.filter((call) => call.url === UPLOAD_URL),
    ).toHaveLength(2);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Uploading Adblock Plus 4.46.0 failed (attempt 1 of 10)",
      ),
    );
  });

  it("gives up after 10 failed uploads", async () => {
    const failedUploads = Array.from({ length: 10 }, unavailable).flat();
    const { fetchImpl, run } = setup([...AUTH_RESPONSES(), ...failedUploads]);

    await expect(run()).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl.calls).toHaveLength(42);
  });

  it("doesn't submit again after a failed submission", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated(),
      textResponse("error", { status: 500 }),
    ]);

    await expect(run()).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl.calls).toHaveLength(5);
  });

  it("attaches the source code again when the store fails", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated(),
      jsonResponse({ id: 99 }),
      ...unavailable(),
      jsonResponse({ id: 99, file: { status: "unreviewed" } }),
    ]);

    const result = await run();

    expect(result.version.file.status).toBe("unreviewed");
    expect(
      fetchImpl.calls.filter((call) => call.method === "PATCH"),
    ).toHaveLength(5);
  });

  it("explains a source upload that failed after submitting", async () => {
    const { run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated(),
      jsonResponse({ id: 99 }),
      textResponse("Bad Request", { status: 400 }),
    ]);

    const error = await run().catch((caught) => caught);

    expect(error.message).toContain(
      "Adblock Plus 4.46.0 was submitted for review, but attaching the source " +
        "code failed",
    );
    expect(error.message).toContain(
      "Upload adblockplus-4.46.0.tar.gz to the version in the AMO developer hub",
    );
    expect(error.cause).toMatchObject({ name: "HttpError", status: 400 });
  });

  it("doesn't submit when validation fails", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated({
        valid: false,
        validation: { messages: [{ type: "error", message: "Bad manifest" }] },
      }),
    ]);

    await expect(run()).rejects.toMatchObject({ code: "ValidationFailed" });
    expect(fetchImpl.calls).toHaveLength(4);
  });

  it("doesn't submit when validation reports unexpected warnings", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse(),
      validated({
        validation: {
          messages: [{ type: "warning", message: "Use of document.write" }],
        },
      }),
    ]);

    await expect(run()).rejects.toMatchObject({
      name: "StoreOperationError",
      store: "amo",
      code: "UnexpectedWarnings",
      details: [{ type: "warning", message: "Use of document.write" }],
    });
    expect(fetchImpl.calls).toHaveLength(4);
  });

  it("refuses to upload a package with a different version", async () => {
    const { fetchImpl, readPackage, run } = setup([], {
      readVersion: vi.fn(async () => "4.45.0"),
    });

    await expect(run()).rejects.toThrow(
      `${PACKAGE_PATH} contains version 4.45.0, ` +
        "but 4.46.0 is being released. Not uploading.",
    );
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("fails before any request when the version can't be read", async () => {
    const unzipError = new Error(
      "End-of-central-directory signature not found",
    );
    const { fetchImpl, run } = setup([], {
      readVersion: vi.fn(async () => {
        throw unzipError;
      }),
    });

    const error = await run().catch((caught) => caught);

    expect(error.message).toBe(
      `Can't read the version from ${PACKAGE_PATH}: ${unzipError.message}`,
    );
    expect(error.cause).toBe(unzipError);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("fails before any request when the reviewer notes are missing", async () => {
    const { fetchImpl, run } = setup([], {
      readNotesForReviewers: vi.fn(async () => {
        throw new Error(
          'STORE_LISTING.md has no "## Firefox AMO notes for reviewers" section',
        );
      }),
    });

    await expect(run()).rejects.toThrow("Firefox AMO notes for reviewers");
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("stops before uploading for a host that isn't configured", async () => {
    const { fetchImpl, readPackage, run } = setup(AUTH_RESPONSES(), {
      host: "ublock",
    });

    await expect(run()).rejects.toThrow(
      'No Firefox Add-ons configuration for host "ublock"',
    );
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("stops before uploading when the secret can't be read", async () => {
    const { fetchImpl, readPackage, run } = setup([
      jsonResponse({ access_token: "federated-token" }),
      textResponse("Permission 'secretmanager.versions.access' denied", {
        status: 403,
      }),
    ]);

    await expect(run()).rejects.toMatchObject({
      name: "HttpError",
      status: 403,
    });
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("stops before uploading when the configuration is incomplete", async () => {
    const { fetchImpl, run } = setup([
      jsonResponse({ access_token: "federated-token" }),
      secretResponse({ ...CONFIG, secret: "" }),
    ]);

    await expect(run()).rejects.toThrow(
      "Secret amo-credentials: missing required option(s): secret",
    );
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("stops before uploading when the package is missing", async () => {
    const missing = Object.assign(new Error("no such file or directory"), {
      code: "ENOENT",
    });
    const { fetchImpl, run } = setup(AUTH_RESPONSES(), {
      readPackage: vi.fn(async () => {
        throw missing;
      }),
    });

    const error = await run().catch((caught) => caught);

    expect(error.message).toBe(
      `Can't read the package at ${PACKAGE_PATH}: no such file or directory`,
    );
    expect(error.cause).toBe(missing);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("requires the host, version, ID token, audience and project", async () => {
    await expect(uploadToAmo({ host: "adblockplus" })).rejects.toThrow(
      "uploadToAmo: missing required option(s): version, idToken, audience, project",
    );
  });
});

describe("findUnexpectedWarnings", () => {
  function uploadWith(...messages) {
    return { processed: true, valid: true, validation: { messages } };
  }

  it("accepts the warnings listed in the release process", () => {
    const uploadResponse = uploadWith(
      {
        type: "warning",
        message: 'Use "browser_specific_settings" instead of "applications".',
      },
      {
        type: "warning",
        message: 'The "data_collection_permissions" property is missing.',
      },
      { type: "warning", message: "Unsafe assignment to innerHTML" },
      { type: "warning", message: "The Function constructor is eval." },
      {
        type: "warning",
        message:
          '"declarativeNetRequest" is not supported in Firefox for Android.',
      },
    );

    expect(findUnexpectedWarnings(uploadResponse)).toEqual([]);
  });

  it("returns other warnings and ignores errors and notices", () => {
    const unexpected = { type: "warning", message: "Use of document.write" };
    const uploadResponse = uploadWith(
      { type: "warning", message: "Unsafe assignment to innerHTML" },
      unexpected,
      { type: "error", message: "Invalid manifest" },
      { type: "notice", message: "Something to know" },
    );

    expect(findUnexpectedWarnings(uploadResponse)).toEqual([unexpected]);
  });
});
