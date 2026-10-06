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
  emptyResponse,
  jsonResponse,
  textResponse,
} from "../test/fake-fetch.js";
import { uploadToEdge } from "./upload.js";

const PRODUCT = {
  name: "Adblock Plus",
  productId: "0f2b8c3e-1111-2222-3333-444455556666",
  clientId: "edge-client-id",
  apiKey: "edge-api-key",
};
const PRODUCT_URL = `https://api.addons.microsoftedge.microsoft.com/v1/products/${PRODUCT.productId}`;
const PACKAGE_PATH =
  "/repo/host/adblockplus/dist/release/adblockplus-chrome-4.46.0-mv3.zip";

function secretResponse(product) {
  return jsonResponse({
    payload: { data: Buffer.from(JSON.stringify(product)).toString("base64") },
  });
}

function accepted(operationId) {
  return emptyResponse({ status: 202, headers: { Location: operationId } });
}

function operation(status, extra = {}) {
  return jsonResponse({ id: "op", status, errorCode: null, ...extra });
}

// STS exchange and configuration secret
const AUTH_RESPONSES = () => [
  jsonResponse({ access_token: "federated-token" }),
  secretResponse(PRODUCT),
];

function setup(responses, overrides = {}) {
  const fetchImpl = createFakeFetch(responses);
  const pkg = new Blob(["zip bytes"]);
  const readVersion = vi.fn(async () => "4.46.0");
  const readPackage = vi.fn(async () => pkg);
  const log = vi.fn();

  const run = () =>
    uploadToEdge({
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

describe("uploadToEdge", () => {
  it("uploads the host's package and submits it for certification", async () => {
    const { fetchImpl, pkg, readVersion, run } = setup([
      ...AUTH_RESPONSES(),
      accepted("upload-op"),
      operation("InProgress"),
      operation("Succeeded"),
      accepted("publish-op"),
      operation("Succeeded"),
    ]);

    const result = await run();

    expect(result.submission.status).toBe("Succeeded");
    expect(readVersion).toHaveBeenCalledWith(PACKAGE_PATH);
    expect(fetchImpl.calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "https://sts.googleapis.com/v1/token"],
      ["GET", expect.stringContaining("/secrets/edge-abp-credentials/")],
      ["POST", `${PRODUCT_URL}/submissions/draft/package`],
      ["GET", `${PRODUCT_URL}/submissions/draft/package/operations/upload-op`],
      ["GET", `${PRODUCT_URL}/submissions/draft/package/operations/upload-op`],
      ["POST", `${PRODUCT_URL}/submissions`],
      ["GET", `${PRODUCT_URL}/submissions/operations/publish-op`],
    ]);
    expect(fetchImpl.calls[2].headers).toMatchObject({
      Authorization: "ApiKey edge-api-key",
      "X-ClientID": "edge-client-id",
    });
    expect(fetchImpl.calls[2].body).toBe(pkg);
  });

  it("stops after the upload in draft-only mode", async () => {
    const { fetchImpl, log, run } = setup(
      [...AUTH_RESPONSES(), accepted("upload-op"), operation("Succeeded")],
      { draftOnly: true },
    );

    const result = await run();

    expect(result.submission).toBeNull();
    expect(fetchImpl.calls).toHaveLength(4);
    expect(log).toHaveBeenLastCalledWith(
      "Uploaded Adblock Plus 4.46.0 as a draft. Publish it in Partner Center.",
    );
  });

  it("reports a previous version that is still in certification", async () => {
    const { run } = setup([
      ...AUTH_RESPONSES(),
      accepted("upload-op"),
      operation("Succeeded"),
      accepted("publish-op"),
      operation("Failed", {
        errorCode: "InProgressSubmission",
        message:
          "Can't publish extension as your extension submission is in progress.",
      }),
    ]);

    await expect(run()).rejects.toMatchObject({
      name: "StoreOperationError",
      store: "edge",
      code: "InProgressSubmission",
    });
  });

  it("refuses to upload a package with a different version", async () => {
    const { fetchImpl, run } = setup([], {
      readVersion: vi.fn(async () => "4.45.0"),
    });

    await expect(run()).rejects.toThrow(
      `${PACKAGE_PATH} contains version 4.45.0, ` +
        "but 4.46.0 is being released. Not uploading.",
    );
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("fails before any request for a host that isn't configured", async () => {
    const { fetchImpl, run } = setup([], { host: "ublock" });

    await expect(run()).rejects.toThrow(
      'No Edge Add-ons configuration for host "ublock"',
    );
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("stops before uploading when the secret can't be read", async () => {
    const { fetchImpl, readPackage, run } = setup([
      jsonResponse({ access_token: "federated-token" }),
      textResponse("Permission denied", { status: 403 }),
    ]);

    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(readPackage).not.toHaveBeenCalled();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("reports an expired API key", async () => {
    const { fetchImpl, run } = setup([
      ...AUTH_RESPONSES(),
      textResponse("Unauthorized", { status: 401 }),
    ]);

    await expect(run()).rejects.toMatchObject({
      name: "HttpError",
      status: 401,
    });
    expect(fetchImpl.calls).toHaveLength(3);
  });

  it("requires the host, version, ID token, audience and project", async () => {
    await expect(uploadToEdge({ host: "adblockplus" })).rejects.toThrow(
      "uploadToEdge: missing required option(s): version, idToken, audience, project",
    );
  });
});
