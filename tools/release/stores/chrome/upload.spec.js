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
import { uploadToChromeWebStore } from "./upload.js";

const ITEM_ID = "cfhdojbkjhnklbpkdaibdccddilifddb";
const ITEM_URL = `https://chromewebstore.googleapis.com/v2/publishers/pub-eyeo/items/${ITEM_ID}`;
const UPLOAD_URL = `https://chromewebstore.googleapis.com/upload/v2/publishers/pub-eyeo/items/${ITEM_ID}:upload`;
const SECRET_URL =
  "https://secretmanager.googleapis.com/v1/projects/15970330933" +
  "/secrets/cws-abp-credentials/versions/latest:access";
const PACKAGE_PATH =
  "/repo/host/adblockplus/dist/release/adblockplus-chrome-4.46.0-mv3.zip";
const PRODUCT = {
  name: "Adblock Plus",
  publisherId: "pub-eyeo",
  itemId: ITEM_ID,
  serviceAccountEmail: "cws-abp@eyeo-extensions.iam.gserviceaccount.com",
};

function secretResponse(product) {
  return jsonResponse({
    payload: {
      data: Buffer.from(JSON.stringify(product)).toString("base64"),
    },
  });
}

// STS exchange, configuration secret, service account token
const AUTH_RESPONSES = () => [
  jsonResponse({ access_token: "federated-token" }),
  secretResponse(PRODUCT),
  jsonResponse({ accessToken: "cws-token" }),
];

function uploadResponse(uploadState, crxVersion) {
  return jsonResponse({ itemId: ITEM_ID, uploadState, crxVersion });
}

function setup(responses, overrides = {}) {
  const fetchImpl = createFakeFetch(responses);
  const pkg = new Blob(["zip bytes"]);
  const readVersion = vi.fn(async () => "4.46.0");
  const readPackage = vi.fn(async () => pkg);
  const log = vi.fn();

  const run = () =>
    uploadToChromeWebStore({
      host: "adblockplus",
      version: "4.46.0",
      idToken: "gitlab-id-token",
      audience:
        "//iam.googleapis.com/projects/15970330933/locations/global/workloadIdentityPools/gitlab/providers/gitlab-com",
      project: "15970330933",
      rootPath: "/repo",
      readVersion,
      readPackage,
      log,
      fetchImpl,
      sleep: vi.fn(async () => {}),
      ...overrides,
    });

  return { fetchImpl, pkg, readVersion, readPackage, log, run };
}

describe("uploadToChromeWebStore", () => {
  it("uploads the host's package and submits it for review", async () => {
    const { fetchImpl, pkg, readVersion, readPackage, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse("SUCCEEDED", "4.46.0"),
      jsonResponse({ itemId: ITEM_ID, state: "PENDING_REVIEW" }),
    ]);

    const result = await run();

    expect(result.submission.state).toBe("PENDING_REVIEW");
    expect(readVersion).toHaveBeenCalledWith(PACKAGE_PATH);
    expect(readPackage).toHaveBeenCalledWith(PACKAGE_PATH);
    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      "https://sts.googleapis.com/v1/token",
      SECRET_URL,
      expect.stringContaining(
        "/serviceAccounts/cws-abp%40eyeo-extensions.iam.gserviceaccount.com:",
      ),
      UPLOAD_URL,
      `${ITEM_URL}:publish`,
    ]);
    expect(fetchImpl.calls[1].headers.Authorization).toBe(
      "Bearer federated-token",
    );
    expect(fetchImpl.calls[2].headers.Authorization).toBe(
      "Bearer federated-token",
    );
    expect(fetchImpl.calls[3].headers.Authorization).toBe("Bearer cws-token");
    expect(fetchImpl.calls[3].body).toBe(pkg);
  });

  it("stops after the upload in draft-only mode", async () => {
    const { fetchImpl, log, run } = setup(
      [...AUTH_RESPONSES(), uploadResponse("SUCCEEDED", "4.46.0")],
      { draftOnly: true },
    );

    const result = await run();

    expect(result.submission).toBeNull();
    expect(fetchImpl.calls).toHaveLength(4);
    expect(log).toHaveBeenLastCalledWith(
      "Uploaded Adblock Plus 4.46.0 as a draft. " +
        "Submit it for review in the Developer Dashboard.",
    );
  });

  it("submits after waiting for a background upload", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse("IN_PROGRESS"),
      jsonResponse({ itemId: ITEM_ID, lastAsyncUploadState: "SUCCEEDED" }),
      jsonResponse({ itemId: ITEM_ID, state: "PENDING_REVIEW" }),
    ]);

    await run();

    expect(fetchImpl.calls.map((call) => call.url).slice(3)).toEqual([
      UPLOAD_URL,
      `${ITEM_URL}:fetchStatus`,
      `${ITEM_URL}:publish`,
    ]);
  });

  it("uploads again when the store fails to process the package", async () => {
    const { fetchImpl, log, run } = setup(
      [
        ...AUTH_RESPONSES(),
        uploadResponse("FAILED"),
        uploadResponse("SUCCEEDED", "4.46.0"),
      ],
      { draftOnly: true },
    );

    await run();

    expect(fetchImpl.calls.map((call) => call.url).slice(3)).toEqual([
      UPLOAD_URL,
      UPLOAD_URL,
    ]);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Uploading Adblock Plus 4.46.0 failed (attempt 1 of 10)",
      ),
    );
  });

  it("gives up after 10 failed uploads", async () => {
    const failedUploads = Array.from({ length: 10 }, () =>
      uploadResponse("FAILED"),
    );
    const { fetchImpl, run } = setup([...AUTH_RESPONSES(), ...failedUploads], {
      draftOnly: true,
    });

    await expect(run()).rejects.toMatchObject({ code: "FAILED" });
    expect(fetchImpl.calls).toHaveLength(13);
  });

  it("doesn't submit again after a failed submission", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      uploadResponse("SUCCEEDED", "4.46.0"),
      textResponse("error", { status: 500 }),
    ]);

    await expect(run()).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl.calls).toHaveLength(5);
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

  it("fails before any request for a host that isn't configured", async () => {
    const { fetchImpl, readVersion, run } = setup([], { host: "ublock" });

    await expect(run()).rejects.toThrow(
      'No Chrome Web Store configuration for host "ublock"',
    );
    expect(readVersion).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(0);
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
      secretResponse({ ...PRODUCT, serviceAccountEmail: "" }),
    ]);

    await expect(run()).rejects.toThrow(
      "Secret cws-abp-credentials: missing required option(s): serviceAccountEmail",
    );
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("stops before uploading when the package is missing", async () => {
    const missing = Object.assign(new Error("no such file or directory"), {
      code: "ENOENT",
    });
    const { fetchImpl, run } = setup(
      [
        jsonResponse({ access_token: "federated-token" }),
        secretResponse(PRODUCT),
      ],
      {
        readPackage: vi.fn(async () => {
          throw missing;
        }),
      },
    );

    const error = await run().catch((caught) => caught);

    expect(error.message).toBe(
      `Can't read the package at ${PACKAGE_PATH}: no such file or directory`,
    );
    expect(error.cause).toBe(missing);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("requires the host, version, ID token, audience and project", async () => {
    await expect(
      uploadToChromeWebStore({ host: "adblockplus" }),
    ).rejects.toThrow(
      "uploadToChromeWebStore: missing required option(s): version, idToken, audience, project",
    );
  });
});
