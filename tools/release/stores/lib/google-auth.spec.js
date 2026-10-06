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

import { createFakeFetch, jsonResponse } from "../test/fake-fetch.js";
import {
  CHROME_WEB_STORE_SCOPE,
  CLOUD_PLATFORM_SCOPE,
  exchangeIdToken,
  generateServiceAccountToken,
  workloadIdentityAudience,
} from "./google-auth.js";

const ID_TOKEN = "gitlab-id-token";
const AUDIENCE =
  "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/gitlab/providers/gitlab-com";
const SERVICE_ACCOUNT = "cws-adblock@eyeo-extensions.iam.gserviceaccount.com";

function noSleep() {
  return vi.fn(async () => {});
}

describe("workloadIdentityAudience", () => {
  it("builds the STS audience of a provider", () => {
    expect(
      workloadIdentityAudience({
        projectNumber: 123,
        poolId: "gitlab",
        providerId: "gitlab-com",
      }),
    ).toBe(AUDIENCE);
  });

  it("requires all parts", () => {
    expect(() => workloadIdentityAudience({ projectNumber: 123 })).toThrow(
      "missing required option(s): poolId, providerId",
    );
  });
});

describe("exchangeIdToken", () => {
  it("exchanges the GitLab ID token at Google STS", async () => {
    const fetchImpl = createFakeFetch([
      jsonResponse({ access_token: "federated-token", expires_in: 3599 }),
    ]);

    const token = await exchangeIdToken({
      idToken: ID_TOKEN,
      audience: AUDIENCE,
      fetchImpl,
    });

    expect(token).toBe("federated-token");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe("https://sts.googleapis.com/v1/token");
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body)).toEqual({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: AUDIENCE,
      scope: CLOUD_PLATFORM_SCOPE,
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectToken: ID_TOKEN,
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
    });
  });

  it("fails before any request when an option is missing", async () => {
    const fetchImpl = createFakeFetch([]);

    await expect(
      exchangeIdToken({ audience: AUDIENCE, fetchImpl }),
    ).rejects.toThrow("exchangeIdToken: missing required option(s): idToken");
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("doesn't retry an exchange Google rejects", async () => {
    const fetchImpl = createFakeFetch([
      jsonResponse({ error: "unauthorized_client" }, { status: 400 }),
    ]);

    await expect(
      exchangeIdToken({
        idToken: ID_TOKEN,
        audience: AUDIENCE,
        fetchImpl,
        sleep: noSleep(),
      }),
    ).rejects.toMatchObject({ name: "HttpError", status: 400 });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("fails when STS returns no token", async () => {
    const fetchImpl = createFakeFetch([jsonResponse({})]);

    await expect(
      exchangeIdToken({ idToken: ID_TOKEN, audience: AUDIENCE, fetchImpl }),
    ).rejects.toThrow("Google STS response contains no access_token");
  });
});

describe("generateServiceAccountToken", () => {
  it("impersonates the service account with the given scopes", async () => {
    const fetchImpl = createFakeFetch([
      jsonResponse({
        accessToken: "cws-token",
        expireTime: "2026-10-01T12:00:00Z",
      }),
    ]);

    const token = await generateServiceAccountToken({
      federatedToken: "federated-token",
      serviceAccountEmail: SERVICE_ACCOUNT,
      scopes: [CHROME_WEB_STORE_SCOPE],
      fetchImpl,
    });

    expect(token).toBe("cws-token");
    const [call] = fetchImpl.calls;
    expect(call.url).toBe(
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
        "cws-adblock%40eyeo-extensions.iam.gserviceaccount.com:generateAccessToken",
    );
    expect(call.headers.Authorization).toBe("Bearer federated-token");
    expect(JSON.parse(call.body)).toEqual({
      scope: [CHROME_WEB_STORE_SCOPE],
      lifetime: "3600s",
    });
  });

  it("requires the scopes", async () => {
    await expect(
      generateServiceAccountToken({
        federatedToken: "federated-token",
        serviceAccountEmail: SERVICE_ACCOUNT,
      }),
    ).rejects.toThrow("missing required option(s): scopes");
  });

  it("reports a missing service account binding", async () => {
    const fetchImpl = createFakeFetch([
      jsonResponse(
        {
          error: {
            message: "Permission 'iam.serviceAccounts.getAccessToken' denied",
          },
        },
        { status: 403 },
      ),
    ]);

    await expect(
      generateServiceAccountToken({
        federatedToken: "federated-token",
        serviceAccountEmail: SERVICE_ACCOUNT,
        scopes: [CHROME_WEB_STORE_SCOPE],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      status: 403,
      body: expect.stringContaining("getAccessToken' denied"),
    });
  });

  it("fails when IAM Credentials returns no token", async () => {
    const fetchImpl = createFakeFetch([jsonResponse({})]);

    await expect(
      generateServiceAccountToken({
        federatedToken: "federated-token",
        serviceAccountEmail: SERVICE_ACCOUNT,
        scopes: [CHROME_WEB_STORE_SCOPE],
        fetchImpl,
      }),
    ).rejects.toThrow("IAM Credentials response contains no accessToken");
  });
});
