/* eslint-disable no-console */
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
import {clearRequestLogs, getRequestLogs, setMinTimeout, setEndpointResponse,
        TEST_ADMIN_PAGES_URL, TEST_PAGES_URL, wait, waitForAssertion,
        waitForSubscriptionToBeSynchronized} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

describe("Telemetry", function() {
  const TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry`;
  const TELEMETRY_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
  const TELEMETRY_ALARM_KEY = "ewe:telemetry";
  const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
  const TELEMETRY_ARGS = {
    url: TELEMETRY_URL,
    bearer: TELEMETRY_BEARER
  };

  it("pings the telemetry server at startup", async function() {
    await waitForAssertion(async() => {
      let result = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
      expect(result[TELEMETRY_STORAGE_KEY]).toEqual(expect.objectContaining({
        firstPing: expect.any(String),
        lastPing: expect.any(String),
        lastPingTag: expect.any(String)
      }));
    });
  });

  it("does not ping again when started multiple times immediately", async function() {
    await EWE.testing.resetTelemetry();
    await clearRequestLogs();

    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);

    // wait for the telemetry requests to be sent
    await new Promise(r => setTimeout(r, 1000 - 100));

    let responses = await getRequestLogs(TELEMETRY_URL);
    expect(responses.length).toEqual(1);
  });

  it("doesn't send request if both url and bearer token aren't provided", async function() {
    await expect(EWE.testing.startTelemetry({url: TELEMETRY_URL}))
      .rejects.toThrow("Error: No telemetry `bearer` provided");
    await expect(EWE.testing.startTelemetry({bearer: TELEMETRY_BEARER}))
      .rejects.toThrow("Error: No telemetry `url` provided");
  });

  it("sends extension metadata to the telemetry server", async function() {
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS);

    await waitForAssertion(async() => {
      let requests = await getRequestLogs(TELEMETRY_URL);
      expect(requests).toEqual([expect.objectContaining({
        url: "/telemetry",
        method: "POST",
        authorization: `Bearer ${TELEMETRY_BEARER}`
      })]);

      const payload = requests[0].body.payload;
      expect(payload.platform).toEqual(expect.oneOf(["win", "Windows", "mac", "macOS", "linux", "Linux"]));
      if (payload.platform_version) {
        expect(payload.platform_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      }
      expect(payload.application)
        .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
      expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.addon_name).toEqual("eyeo-webext-sdk");
      expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.extension_name).toEqual("eyeo's Web Extension Ad Blocking Toolkit Test Extension");
      expect(payload.extension_version).toEqual("0.0.1");
      expect(payload.aa_active).toEqual(false);
    });
  });

  it("sends a request at regular intervals, every 6 seconds", async function() {
    setMinTimeout(this, 20000);
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.1);

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });

    // wait 3s for next ping to NOT have happened yet
    await new Promise(r => setTimeout(r, 3000));
    expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);

    // wait 3s more (6s total) for next ping to happen
    await new Promise(r => setTimeout(r, 3000));
    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(2);
    });

    // wait 6s for next ping to happen
    await new Promise(r => setTimeout(r, 6000));
    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(3);
    });
  });

  it("can send a requests every 3 seconds if configured to", async function() {
    setMinTimeout(this, 20000);
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.05);

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });

    // wait 3s for next ping to happen
    await new Promise(r => setTimeout(r, 3000));
    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(2);
    });
  });

  it("sends a request at regular intervals, every 6 seconds, when telemetry is restarted in the middle", async function() {
    setMinTimeout(this, 10000);
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.1);

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });

    // wait a bit, then restart telemetry. Make sure it doesn't immediately do
    // another request.
    await new Promise(r => setTimeout(r, 2000));
    await EWE.testing.stopTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.1);

    await new Promise(r => setTimeout(r, 1000));
    expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);

    // wait 3s more (6s total) for next ping to happen
    await new Promise(r => setTimeout(r, 3000));

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(2);
    });
  });

  it("schedules the next ping if the service worker is suspended before it is time for the next ping [mv3-only]", async function() {
    setMinTimeout(this, 10000);
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.1);

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });

    let firstPing = Date.now();
    let tolerance = 1000;

    await waitForAssertion(async() => {
      let expectedNextPing = firstPing + 6000;
      let alarm = await browser.alarms.get(TELEMETRY_ALARM_KEY);
      expect(alarm.periodInMinutes).toBeUndefined();
      expect(alarm.scheduledTime)
        .toBeGreaterThanOrEqual(expectedNextPing - tolerance);
      expect(alarm.scheduledTime)
        .toBeLessThanOrEqual(expectedNextPing + tolerance);
    });

    await suspendServiceWorker(this);

    // We expect the (existing) alarm to fire after 6 seconds, waking the
    // service worker
    await new Promise(r => setTimeout(r, 6000));

    // After starting up, we expect the next ping to be reset to its default
    // value: 12 hours. It shouldn't ping now because that time hasn't been
    // reached yet. Rather, we should just get a new alarm and no new ping..
    await waitForAssertion(async() => {
      let expectedNextPing = firstPing + 12 * MILLIS_IN_HOUR;
      let afterSuspendAlarm = await browser.alarms.get(TELEMETRY_ALARM_KEY);
      expect(afterSuspendAlarm.periodInMinutes).toBeUndefined();
      expect(afterSuspendAlarm.scheduledTime)
        .toBeGreaterThanOrEqual(expectedNextPing - tolerance);
      expect(afterSuspendAlarm.scheduledTime)
        .toBeLessThanOrEqual(expectedNextPing + tolerance);
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });
  });

  it("pings immediately if the service worker is suspended after it is time for the next ping [mv3-only]", async function() {
    setMinTimeout(this, 10000);
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();
    await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.1);

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
    });

    let firstPing = Date.now();
    let expectedNextPing = firstPing + 6000;
    let tolerance = 1000;

    await waitForAssertion(async() => {
      let alarm = await browser.alarms.get(TELEMETRY_ALARM_KEY);
      expect(alarm.periodInMinutes).toBeUndefined();
      expect(alarm.scheduledTime)
        .toBeGreaterThanOrEqual(expectedNextPing - tolerance);
      expect(alarm.scheduledTime)
        .toBeLessThanOrEqual(expectedNextPing + tolerance);
    });

    await suspendServiceWorker(this);

    let storage = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
    let telemetryStorage = storage[TELEMETRY_STORAGE_KEY];
    let adjustedLastPing =
        new Date(telemetryStorage.lastPing).getTime() - 12 * MILLIS_IN_HOUR;
    telemetryStorage.lastPing = new Date(adjustedLastPing).toISOString();
    await browser.storage.local.set({
      [TELEMETRY_STORAGE_KEY]: telemetryStorage
    });

    // We expect the (existing) alarm to fire after 6 seconds, waking the
    // service worker
    await new Promise(r => setTimeout(r, 6000));

    await waitForAssertion(async() => {
      expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(2);
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
      let telemetryRequests = await getRequestLogs(TELEMETRY_URL);

      expect(telemetryRequests).toEqual([expect.objectContaining({
        url: "/telemetry",
        method: "POST",
        authorization: `Bearer ${TELEMETRY_BEARER}`
      })]);

      const payload = telemetryRequests[0].body.payload;
      expect(payload.aa_active).toEqual(false);
    });
  });

  for (let aaUrlPropertyName of ["ACCEPTABLE_ADS_PRIVACY_URL", "ACCEPTABLE_ADS_URL"]) {
    it(`sends AA active extension metadata to the telemetry server when ${aaUrlPropertyName} is active`, async function() {
      setMinTimeout(this, 6000);

      let aaUrl = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "subscriptions"},
        {op: "getProp", arg: aaUrlPropertyName}
      ]);
      await EWE.subscriptions.add(aaUrl);

      const notAnAAUrl = `${TEST_PAGES_URL}/subscription.txt`;
      await EWE.subscriptions.add(notAnAAUrl);

      await clearRequestLogs();
      await EWE.testing.resetTelemetry();
      await EWE.testing.startTelemetry(TELEMETRY_ARGS);

      await waitForAssertion(async() => {
        let telemetryRequests = await getRequestLogs(TELEMETRY_URL);

        expect(telemetryRequests).toEqual([expect.objectContaining({
          url: "/telemetry",
          method: "POST",
          authorization: `Bearer ${TELEMETRY_BEARER}`
        })]);

        const payload = telemetryRequests[0].body.payload;
        expect(payload.aa_active).toEqual(true);
      });
    });
  }

  describe("Last ping metadata", function() {
    // these days are all in the past, so if we restart telemetry after making
    // these the last ping, it should ping immediately.
    let pingDays = ["2023-05-24", "2023-05-25", "2023-05-26"];

    // the server will respond with a time that has a 10 minute precision.
    let pingServerResponses = pingDays.map(d => d + "T12:34:50Z");

    // the values we should send must be truncated to just the day part.
    let pingLogs = pingDays.map(d => d + "T00:00:00Z");

    async function getPayloadsAfterNPings(n) {
      await EWE.testing.resetTelemetry();

      let payloads = [];

      for (let i = 0; i < n; i++) {
        await setEndpointResponse(TELEMETRY_URL, JSON.stringify({
          token: pingServerResponses[i]
        }), "POST");
        await clearRequestLogs();
        await EWE.testing.startTelemetry(TELEMETRY_ARGS);

        await wait(async() => {
          let requests = await getRequestLogs(TELEMETRY_URL);
          if (requests.length > 0) {
            payloads.push(requests[0].body.payload);
            return true;
          }
          return false;
        });

        await EWE.testing.stopTelemetry(TELEMETRY_ARGS);
      }

      return payloads;
    }

    it("doesn't send any last ping metadata for the first request", async function() {
      let payloads = await getPayloadsAfterNPings(1);

      expect(payloads[0]).not.toHaveProperty("first_ping");
      expect(payloads[0]).not.toHaveProperty("last_ping");
      expect(payloads[0]).not.toHaveProperty("last_ping_tag");
      expect(payloads[0]).not.toHaveProperty("previous_last_ping");
    });

    it("sends last ping and first ping for the second request", async function() {
      let payloads = await getPayloadsAfterNPings(2);

      expect(payloads[1]).toEqual(expect.objectContaining({
        first_ping: pingLogs[0],
        last_ping: pingLogs[0],
        last_ping_tag: expect.any(String)
      }));
      expect(payloads[1]).not.toHaveProperty("previous_last_ping");
    });

    it("sends previous last ping, last ping and first ping for the third request", async function() {
      let payloads = await getPayloadsAfterNPings(3);

      expect(payloads[2]).toEqual(expect.objectContaining({
        first_ping: pingLogs[0],
        last_ping: pingLogs[1],
        previous_last_ping: pingLogs[0],
        last_ping_tag: expect.any(String)
      }));
      expect(payloads[2].last_ping_tag).not.toEqual(payloads[1].last_ping_tag);
    });
  });

  describe("Integration", function() {
    it("can successfully send a payload to the eyeometry staging server", async function() {
      setMinTimeout(this, 11000);

      // These credentials can be set by setting the environment variables with
      // the same name before running webpack.
      let eyeometryArgs = {
        url: webpackDotenvPlugin.EWE_EYEOMETRY_URL,
        bearer: webpackDotenvPlugin.EWE_EYEOMETRY_BEARER
      };
      if (!eyeometryArgs.url || !eyeometryArgs.bearer) {
        this.skip();
      }

      await EWE.testing.resetTelemetry();
      await EWE.testing.startTelemetry(eyeometryArgs);

      // When we have an onError event, it would be good to surface that value
      // if this test fails.
      await waitForAssertion(async() => {
        let result = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
        expect(result[TELEMETRY_STORAGE_KEY]).toEqual(expect.objectContaining({
          firstPing: expect.any(String),
          lastPing: expect.any(String),
          lastPingTag: expect.any(String)
        }));
      }, 10000);
    });
  });
});
