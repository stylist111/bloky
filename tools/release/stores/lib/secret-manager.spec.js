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
import { accessSecretVersion } from "./secret-manager.js";

const SECRET_URL =
  "https://secretmanager.googleapis.com/v1/projects/15970330933/secrets/cws-adblock-credentials";
const OPTIONS = {
  accessToken: "federated-token",
  project: 15970330933,
  secret: "cws-adblock-credentials",
};

function secretResponse(value) {
  return jsonResponse({
    name: "projects/15970330933/secrets/cws-adblock-credentials/versions/1",
    payload: { data: Buffer.from(value).toString("base64") },
  });
}

describe("accessSecretVersion", () => {
  it("returns the decoded value of the latest version", async () => {
    const fetchImpl = createFakeFetch([secretResponse('{"name":"AdBlock"}')]);

    const value = await accessSecretVersion({ ...OPTIONS, fetchImpl });

    expect(value).toBe('{"name":"AdBlock"}');
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(`${SECRET_URL}/versions/latest:access`);
    expect(call.method).toBe("GET");
    expect(call.headers.Authorization).toBe("Bearer federated-token");
  });

  it("decodes UTF-8 values", async () => {
    const fetchImpl = createFakeFetch([secretResponse("Ünïcødé ✓")]);

    expect(await accessSecretVersion({ ...OPTIONS, fetchImpl })).toBe(
      "Ünïcødé ✓",
    );
  });

  it("reads a specific version when asked", async () => {
    const fetchImpl = createFakeFetch([secretResponse("old")]);

    await accessSecretVersion({ ...OPTIONS, version: "3", fetchImpl });

    expect(fetchImpl.calls[0].url).toBe(`${SECRET_URL}/versions/3:access`);
  });

  it("doesn't retry when access is denied", async () => {
    const fetchImpl = createFakeFetch([
      textResponse("Permission 'secretmanager.versions.access' denied", {
        status: 403,
      }),
    ]);

    await expect(
      accessSecretVersion({ ...OPTIONS, fetchImpl }),
    ).rejects.toMatchObject({ name: "HttpError", status: 403 });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("fails when the response has no payload", async () => {
    const fetchImpl = createFakeFetch([jsonResponse({ name: "x" })]);

    await expect(
      accessSecretVersion({ ...OPTIONS, fetchImpl }),
    ).rejects.toThrow("contains no payload");
  });

  it("requires a token, project and secret", async () => {
    await expect(accessSecretVersion({ project: 1 })).rejects.toThrow(
      "accessSecretVersion: missing required option(s): accessToken, secret",
    );
  });
});
