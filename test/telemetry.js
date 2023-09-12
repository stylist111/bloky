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
        clearEndpointResponse, TEST_ADMIN_PAGES_URL, TEST_PAGES_URL, wait,
        waitForAssertion, waitForSubscriptionToBeSynchronized}
  from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {MILLIS_IN_HOUR, MILLIS_IN_MINUTE} from "adblockpluscore/lib/time.js";

describe("Telemetry", function() {
  const TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry`;
  const TELEMETRY_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
  const TELEMETRY_ALARM_KEY = "ewe:telemetry";
  const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
  const TELEMETRY_ARGS = {
    url: TELEMETRY_URL,
    bearer: TELEMETRY_BEARER
  };

  describe("Startup", function() {
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
  });

  describe("Running", function() {
    // Some of these unfortunately need to wait for pings to happen (or not
    // happen) and so can get a bit long.
    setMinTimeout(this, 20000);

    beforeEach(async function() {
      await clearRequestLogs();
      await EWE.testing.resetTelemetry();
    });

    afterEach(async function() {
      await clearEndpointResponse(TELEMETRY_URL);
    });

    const PING_INTERVAL_MS = 6000;
    const ERROR_DELAY_MS = 3000;

    async function startTelemetryWithTestArgs() {
      await EWE.testing.startTelemetry(TELEMETRY_ARGS,
                                       PING_INTERVAL_MS / MILLIS_IN_MINUTE,
                                       ERROR_DELAY_MS / MILLIS_IN_MINUTE);
    }

    async function delayThenExpectNoNewPings(delay, currentPingCount) {
      await new Promise(r => setTimeout(r, delay));
      expect(await getRequestLogs(TELEMETRY_URL))
        .toHaveLength(currentPingCount);
    }

    async function expectNextPing(expectedNewPingCount) {
      await waitForAssertion(async() => {
        expect(await getRequestLogs(TELEMETRY_URL))
          .toHaveLength(expectedNewPingCount);
      });
    }

    async function delayThenExpectNextPing(delay, expectedNewPingCount) {
      await new Promise(r => setTimeout(r, delay));
      await expectNextPing(expectedNewPingCount);
    }

    it("does not ping again when started multiple times immediately", async function() {
      startTelemetryWithTestArgs();
      startTelemetryWithTestArgs();
      startTelemetryWithTestArgs();

      await delayThenExpectNoNewPings(900, 1);
    });

    it("doesn't send request if both url and bearer token aren't provided", async function() {
      await expect(EWE.testing.startTelemetry({url: TELEMETRY_URL}))
        .rejects.toThrow("Error: No telemetry `bearer` provided");
      await expect(EWE.testing.startTelemetry({bearer: TELEMETRY_BEARER}))
        .rejects.toThrow("Error: No telemetry `url` provided");
    });

    it("sends extension metadata to the telemetry server", async function() {
      startTelemetryWithTestArgs();

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
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNoNewPings(PING_INTERVAL_MS / 2, 1);
      await delayThenExpectNextPing(PING_INTERVAL_MS / 2, 2);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 3);
    });

    it("can send a requests every 3 seconds if configured to", async function() {
      await EWE.testing.startTelemetry(TELEMETRY_ARGS, 0.05);

      await expectNextPing(1);
      await delayThenExpectNextPing(3000, 2);
    });

    it("sends a request at regular intervals, every 6 seconds, when telemetry is restarted in the middle", async function() {
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      // wait a bit, then restart telemetry. Make sure it doesn't immediately do
      // another request.
      await new Promise(r => setTimeout(r, 2000));
      await EWE.testing.stopTelemetry();
      await startTelemetryWithTestArgs();

      await delayThenExpectNoNewPings(1000, 1);
      await delayThenExpectNextPing(PING_INTERVAL_MS / 2, 2);
    });

    it("schedules the next ping if the service worker is suspended before it is time for the next ping [mv3-only]", async function() {
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      let firstPing = Date.now();
      let tolerance = 1000;

      await waitForAssertion(async() => {
        let expectedNextPing = firstPing + PING_INTERVAL_MS;
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
      await new Promise(r => setTimeout(r, PING_INTERVAL_MS));

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
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      let firstPing = Date.now();
      let expectedNextPing = firstPing + PING_INTERVAL_MS;
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
      // service worker, and then ping immediately.
      await delayThenExpectNextPing(PING_INTERVAL_MS, 2);
    });

    it("sends a request after the error delay if the server had an error", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNoNewPings(ERROR_DELAY_MS / 2, 1);
      await delayThenExpectNextPing(ERROR_DELAY_MS / 2, 2);
    });

    it("sends a request after the error delay if the server had an invalid response", async function() {
      await setEndpointResponse(TELEMETRY_URL, "this isn't even valid JSON", "POST");
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNoNewPings(ERROR_DELAY_MS / 2, 1);
      await delayThenExpectNextPing(ERROR_DELAY_MS / 2, 2);
    });

    it("goes back to regular ping interval when it succeeds", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      await clearEndpointResponse(TELEMETRY_URL);
      await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 3);
    });

    it("sends a request after the error delay if the server had an error, when telemetry is restarted in the middle", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNoNewPings(1000, 1);

      await EWE.testing.stopTelemetry();
      await startTelemetryWithTestArgs();

      await delayThenExpectNoNewPings(1000, 1);
      await delayThenExpectNextPing(ERROR_DELAY_MS - 2000, 2);
    });

    it("sends a request at most the max error delay when telemetry is restarted in the middle, even if the clock has changed", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      await EWE.testing.stopTelemetry();

      // We'll fiddle the lastError timestamp to simulate the computer's
      // clock going back in time.
      let storage = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
      expect(storage[TELEMETRY_STORAGE_KEY].lastError)
        .toEqual(expect.any(String));
      let distantFuture = new Date();
      distantFuture.setUTCFullYear(distantFuture.getUTCFullYear() + 1);
      await browser.storage.local.set({
        [TELEMETRY_STORAGE_KEY]: {
          ...storage[TELEMETRY_STORAGE_KEY],
          lastError: distantFuture.toISOString()
        }
      });

      await startTelemetryWithTestArgs();

      // Just looking at the times in storage, we should next be pinging only
      // next year! This is almost definitely a clock issue, so the next ping
      // should be at most an hour away.
      await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
    });

    it("schedules the next ping after the default error delay if the server had an error, when the service worker restarts in the middle [mv3-only]", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);

      let firstPing = Date.now();
      let tolerance = 1000;

      await suspendServiceWorker(this);

      // We expect the (existing) alarm to fire after 3 seconds, waking the
      // service worker
      await new Promise(r => setTimeout(r, ERROR_DELAY_MS));

      // After starting up, we expect the next ping to be reset to its default
      // value: 1 hour. It shouldn't ping now because that time hasn't been
      // reached yet. Rather, we should just get a new alarm and no new ping..
      await waitForAssertion(async() => {
        let expectedNextPing = firstPing + MILLIS_IN_HOUR;
        let afterSuspendAlarm = await browser.alarms.get(TELEMETRY_ALARM_KEY);
        expect(afterSuspendAlarm.periodInMinutes).toBeUndefined();
        expect(afterSuspendAlarm.scheduledTime)
          .toBeGreaterThanOrEqual(expectedNextPing - tolerance);
        expect(afterSuspendAlarm.scheduledTime)
          .toBeLessThanOrEqual(expectedNextPing + tolerance);
        expect(await getRequestLogs(TELEMETRY_URL)).toHaveLength(1);
      });
    });

    it("sends AA active (as false) extension metadata to the telemetry server when non AA subscriptions are active", async function() {
      const notAnAAUrl = `${TEST_PAGES_URL}/subscription.txt`;
      await EWE.subscriptions.add(notAnAAUrl);
      await waitForSubscriptionToBeSynchronized(notAnAAUrl);

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
        let aaUrl = await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "subscriptions"},
          {op: "getProp", arg: aaUrlPropertyName}
        ]);
        await EWE.subscriptions.add(aaUrl);

        const notAnAAUrl = `${TEST_PAGES_URL}/subscription.txt`;
        await EWE.subscriptions.add(notAnAAUrl);

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

          await EWE.testing.stopTelemetry();
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
        expect(payloads[2].last_ping_tag)
          .not.toEqual(payloads[1].last_ping_tag);
      });
    });
  });

  describe("Integration", function() {
    it("can successfully send a payload to the eyeometry staging server", async function() {
      setMinTimeout(this, 11000);
      await EWE.testing.resetTelemetry();

      // These credentials can be set by setting the environment variables with
      // the same name before running webpack.
      let eyeometryArgs = {
        url: webpackDotenvPlugin.EWE_EYEOMETRY_URL,
        bearer: webpackDotenvPlugin.EWE_EYEOMETRY_BEARER
      };
      if (!eyeometryArgs.url || !eyeometryArgs.bearer) {
        this.skip();
      }

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
