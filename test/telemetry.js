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
import {MILLIS_IN_HOUR, MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

import {EWE, runInBackgroundPage, expectTestEvents} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {clearRequestLogs, getRequestLogs, setMinTimeout, setEndpointResponse,
        clearEndpointResponse, waitForAssertion,
        waitForSubscriptionToBeSynchronized} from "./utils.js";
import {subTestCustom1} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";

describe("Telemetry", function() {
  const TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry`;
  const TELEMETRY_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
  const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
  const TELEMETRY_ARGS = {
    url: TELEMETRY_URL,
    bearer: TELEMETRY_BEARER
  };

  describe("Startup", function() {
    it("does not ping the telemetry server on first startup until opted in", async function() {
      let startupResult =
          await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
      expect(startupResult[TELEMETRY_STORAGE_KEY]).toBeUndefined();

      await EWE.telemetry.setOptOut(false);

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
    setMinTimeout(this, 15000);

    beforeEach(async function() {
      await clearRequestLogs();
      await EWE.testing.resetTelemetry();
      await EWE.telemetry.setOptOut(false);
    });

    afterEach(async function() {
      await clearEndpointResponse(TELEMETRY_URL);
    });

    const PING_INTERVAL_MS = 4000;
    const ERROR_DELAY_MS = 2000;

    async function startTelemetryWithTestArgs() {
      await EWE.testing.startTelemetry(TELEMETRY_ARGS, PING_INTERVAL_MS,
                                       ERROR_DELAY_MS);
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

      await delayThenExpectNextPing(1000, 1);
    });

    it("does not ping when both url and bearer token aren't provided", async function() {
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
        expect(payload.addon_name).toEqual("eyeo-webext-ad-filtering-solution");
        expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
        expect(payload.extension_name).toEqual("eyeo's WebExtension Ad-Filtering Solution Test Extension");
        expect(payload.extension_version).toMatch(/0\.0\.\d/);
        expect(payload.aa_active).toEqual(false);
      });
    });

    it("pings at regular intervals", async function() {
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 2);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 3);
    });

    it("pings at regular configurable intervals", async function() {
      const interval = 2000;
      await EWE.testing.startTelemetry(TELEMETRY_ARGS, interval);

      await expectNextPing(1);
      await delayThenExpectNextPing(interval, 2);
    });

    it("stops pinging when opted out", async function() {
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await EWE.telemetry.setOptOut(true);

      await new Promise(r =>
        setTimeout(r, PING_INTERVAL_MS + MILLIS_IN_SECOND));
      expect(await getRequestLogs(TELEMETRY_URL))
        .toHaveLength(1);
    });

    it("does not ping if started opted out", async function() {
      await EWE.telemetry.setOptOut(true);
      await startTelemetryWithTestArgs();

      await new Promise(r => setTimeout(r, PING_INTERVAL_MS));
      expect(await getRequestLogs(TELEMETRY_URL))
        .toHaveLength(0);
    });

    it("pings using the error delay after a server error", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
    });

    it("pings using the error delay after an invalid response", async function() {
      await setEndpointResponse(TELEMETRY_URL, "this isn't even valid JSON", "POST");
      await startTelemetryWithTestArgs();

      await expectNextPing(1);
      await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
    });

    it("goes back to regular ping intervals when it succeeds", async function() {
      await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
      await startTelemetryWithTestArgs();
      await expectNextPing(1);

      await clearEndpointResponse(TELEMETRY_URL);
      await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 3);
    });

    it("sends AA active (as false) extension metadata to the telemetry server when non AA subscriptions are active", async function() {
      const notAnAAUrl = subTestCustom1.url;
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

    it("sends AA active extension metadata to the telemetry server when an AA subscription is active", async function() {
      let aaUrl = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "subscriptions"},
        {op: "getProp", arg: "ACCEPTABLE_ADS_PRIVACY_URL"}
      ]);
      await EWE.subscriptions.add(aaUrl);

      const notAnAAUrl = subTestCustom1.url;
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

    describe("Telemetry restart", function() {
      it("pings at regular intervals", async function() {
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await EWE.testing.stopTelemetry();
        await startTelemetryWithTestArgs();

        await delayThenExpectNextPing(PING_INTERVAL_MS, 2);
      });

      it("pings using the error delay after a server error", async function() {
        await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await EWE.testing.stopTelemetry();
        await startTelemetryWithTestArgs();

        await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
      });

      it("pings at most the max error delay when the clock has changed", async function() {
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
    });

    describe("Service worker suspension [mv3-only]", function() {
      it("schedules the next ping when the service worker is suspended before the next ping", async function() {
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await new Promise(r => setTimeout(r, PING_INTERVAL_MS / 2));
        await suspendServiceWorker(this);

        // Service worker is woken up at this point
        await EWE.testing.stopTelemetry();
        await startTelemetryWithTestArgs();

        await delayThenExpectNextPing(PING_INTERVAL_MS / 2, 2);
      });

      it("does not ping after service worker activates if opted out", async function() {
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await EWE.telemetry.setOptOut(true);
        await suspendServiceWorker(this);

        // Service worker is woken up at this point. Should be opted out still,
        // so no pings will occur.
        await EWE.testing.stopTelemetry();
        await startTelemetryWithTestArgs();

        await new Promise(r =>
          setTimeout(r, PING_INTERVAL_MS + MILLIS_IN_SECOND));
        expect(await getRequestLogs(TELEMETRY_URL))
          .toHaveLength(1);
      });

      it("pings immediately when the service worker is suspended after the next ping", async function() {
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await suspendServiceWorker(this);

        let storage = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
        let telemetryStorage = storage[TELEMETRY_STORAGE_KEY];
        let adjustedLastPing =
           new Date(telemetryStorage.lastPing).getTime() - 12 * MILLIS_IN_HOUR;
        telemetryStorage.lastPing = new Date(adjustedLastPing).toISOString();
        await browser.storage.local.set({
          [TELEMETRY_STORAGE_KEY]: telemetryStorage
        });

        // this is just to give the service worker some ping to wake it
        // up. Specific call doesn't matter.
        await EWE.testing._waitForInitialization();

        await expectNextPing(2);
      });

      it("pings using the error delay when the service worker is suspended after a server error", async function() {
        await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
        await startTelemetryWithTestArgs();
        await expectNextPing(1);

        await suspendServiceWorker(this);

        await EWE.testing.stopTelemetry();
        await startTelemetryWithTestArgs();

        await delayThenExpectNextPing(ERROR_DELAY_MS, 2);
      });
    });

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

      it("listens to onError events for error status codes", async function() {
        await setEndpointResponse(TELEMETRY_URL, {}, "POST", 500);
        await startTelemetryWithTestArgs();
        await expectTestEvents("telemetry.onError", [[{
          message: "Telemetry server responded with error status 500.",
          lastError: expect.any(String)
        }]], 1000);
      });

      it("listens to onError events for missing data", async function() {
        await setEndpointResponse(TELEMETRY_URL, {}, "POST");
        await startTelemetryWithTestArgs();
        await expectTestEvents("telemetry.onError", [[{
          message: "Telemetry server response did not include a token.",
          lastError: expect.any(String)
        }]]);
      });

      it("listens to onError events for network error", async function() {
        await EWE.testing.startTelemetry({
          url: "invalid-url.invalid", // https://en.wikipedia.org/wiki/.invalid
          bearer: TELEMETRY_BEARER
        });
        // These are the error message from the browser, just passed through. It
        // might be different on different browsers, and might need to grow as
        // browsers change their error messages.
        await expectTestEvents("telemetry.onError", [[{
          message: expect.oneOf([
            "NetworkError when attempting to fetch resource.",
            "Failed to fetch",
            "The operation was aborted. "
          ]),
          lastError: expect.any(String)
        }]]);
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
