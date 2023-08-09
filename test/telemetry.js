/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import expect from "expect";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {clearRequestLogs, getRequestLogs,
        isFirefox, isIncognito,
        TEST_ADMIN_PAGES_URL, TEST_PAGES_URL,
        waitForAssertion, waitForSubscriptionToBeSynchronized} from "./utils.js";

describe("Telemetry", function() {
  const TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry`;
  const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
  const TELEMETRY_ARGS = {
    url: TELEMETRY_URL,
    bearer: "bbb"
  };

  it("pings the telemetry server at startup", async function() {
    await waitForAssertion(async() => {
      let result = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
      expect(result[TELEMETRY_STORAGE_KEY]).toEqual({
        firstPing: expect.any(String)
      });
    });
  });

  it("does not ping again when started multiple times immediately", async function() {
    await EWE.testing.resetTelemetry();
    await clearRequestLogs();

    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);

    // wait for the telemetry requests to be sent
    await new Promise(r => setTimeout(r, 1000));

    let responses = await getRequestLogs();
    expect(responses.filter(request => request.url == "/telemetry").length)
      .toEqual(1);
  });

  it("doesn't ping again when starting again later", async function() {
    await clearRequestLogs();
    await EWE.testing.stopTelemetry();

    EWE.testing.startTelemetry(TELEMETRY_ARGS);

    // wait for the telemetry requests to be sent
    await new Promise(r => setTimeout(r, 1000));

    let responses = await getRequestLogs();
    expect(responses.filter(request => request.url == "/telemetry").length)
      .toEqual(0);
  });

  it("doesn't send request if both url and bearer token aren't provided", async function() {
    await expect(EWE.testing.startTelemetry({url: TELEMETRY_URL}))
      .rejects.toThrow("Error: No telemetry `bearer` provided");
    await expect(EWE.testing.startTelemetry({bearer: "bbb"}))
      .rejects.toThrow("Error: No telemetry `url` provided");
  });

  it("sends extension metadata to the telemetry server", async function() {
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS);

    await waitForAssertion(async() => {
      let requests = await getRequestLogs();
      expect(requests).toEqual([expect.objectContaining({
        url: "/telemetry",
        method: "POST"
      })]);

      const telemetryFetchPayload = requests.filter(request => {
        return request.url == "/telemetry";
      })[0];

      const payload = telemetryFetchPayload.body.payload;
      expect(payload.platform).toEqual(expect.oneOf(["win", "Windows", "mac", "macOS", "linux", "Linux"]));
      if (payload.platform_version) {
        expect(payload.platform_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      }
      expect(payload.application).toEqual(expect.oneOf(["firefox", "chrome", "edg"]));
      expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.addon_name).toEqual("eyeo-webext-sdk");
      expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.extension_name).toEqual("eyeo's Web Extension Ad Blocking Toolkit Test Extension");
      expect(payload.extension_version).toEqual("0.0.1");
      expect(payload.aa_active).toEqual(false);
    });
  });

  it("sends AA active (as false) extension metadata to the telemetry server when non AA subscriptions are active", async function() {
    const notAnAAUrl = `${TEST_PAGES_URL}/subscription.txt`;
    await EWE.subscriptions.add(notAnAAUrl);
    await waitForSubscriptionToBeSynchronized(notAnAAUrl);

    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS);

    await waitForAssertion(async() => {
      let telemetryRequests = await getRequestLogs();

      const telemetryFetchPayload = telemetryRequests.filter(request => {
        return request.url == "/telemetry";
      });

      expect(telemetryRequests).toEqual([expect.objectContaining({
        url: "/telemetry",
        method: "POST"
      })]);

      const payload = telemetryFetchPayload[0].body.payload;
      expect(payload.aa_active).toEqual(false);
    });
  });

  for (let aaUrlPropertyName of ["ACCEPTABLE_ADS_PRIVACY_URL", "ACCEPTABLE_ADS_URL"]) {
    it(`sends AA active extension metadata to the telemetry server when ${aaUrlPropertyName} is active`, async function() {
      this.timeout(6000);

      let aaUrl = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "subscriptions"},
        {op: "getProp", arg: aaUrlPropertyName}
      ]);
      await EWE.subscriptions.add(aaUrl);
      await waitForSubscriptionToBeSynchronized(aaUrl);

      const notAnAAUrl = `${TEST_PAGES_URL}/subscription.txt`;
      await EWE.subscriptions.add(notAnAAUrl);
      await waitForSubscriptionToBeSynchronized(notAnAAUrl);

      if (isFirefox() && isIncognito()) {
        await new Promise(r => setTimeout(r, 500));
      }
      await clearRequestLogs();
      await EWE.testing.resetTelemetry();
      await EWE.testing.startTelemetry(TELEMETRY_ARGS);
      if (isFirefox() && isIncognito()) {
        await new Promise(r => setTimeout(r, 500));
      }

      await waitForAssertion(async() => {
        let telemetryRequests = await getRequestLogs();

        const telemetryFetchPayload = telemetryRequests.filter(request => {
          return request.url == "/telemetry";
        });

        expect(telemetryRequests).toEqual([expect.objectContaining({
          url: "/telemetry",
          method: "POST"
        })]);

        const payload = telemetryFetchPayload[0].body.payload;
        expect(payload.aa_active).toEqual(true);
      });
    });
  }
});
