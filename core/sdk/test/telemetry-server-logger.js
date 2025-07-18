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
import sinon from "sinon/pkg/sinon.js";

import {EWE} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {Page, waitForAssertion, ISO_DATE_REGEX, getRequestLogs,
        clearRequestLogs, setMinTimeout, setEndpointResponse,
        clearEndpointResponse} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {wait} from "./polling.js";

const acceptedLevelsByLevel = new Map([
  ["off", []],
  ["warn", ["warn"]],
  ["behavior", ["warn", "behavior"]],
  ["info", ["warn", "behavior", "info"]],
  ["debug", ["warn", "behavior", "info", "debug"]]
]);

const module1 = "test_ewe_background";
const module2 = "test_ewe_ui_api";
const contentScriptModule = "test_ewe_content_api";
const uiPageModule = "test_ewe_ui_api";

const DEBUG_TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry-log-event`;
const DEBUG_TELEMETRY_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
const UPLOADER_STORAGE_KEY = "ewe:telemetry-server-log-uploader";
const REMOTE_CONFIG_URL = `${TEST_ADMIN_PAGES_URL}/experiments.json`;

const INTERVAL_BETWEEN_BATCHES = 1000;
const ERROR_DELAY = 2000;
const ERROR_RETRY_ATTEMPTS = 3;

async function getRequestLogIntervals() {
  let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
  let diffs = [];

  for (let index = 1; index < requestLogs.length; index++) {
    let timeDifference = new Date(requestLogs[index].timestamp).getTime() -
      new Date(requestLogs[index - 1].timestamp).getTime();

    diffs.push(Math.round(timeDifference / 1000) * 1000);
  }

  const intervals = [diffs[0]];
  let currentDiff = diffs[0];

  for (let i = 1; i < diffs.length; i++) {
    if (diffs[i] !== currentDiff) {
      intervals.push(diffs[i]);
      currentDiff = diffs[i];
    }
  }

  return intervals;
}

async function logAllEvents() {
  await EWE.testing.serverLogger.debug("test_event_no_data");
  await EWE.testing.serverLogger.info("test_event_no_data");
  await EWE.testing.serverLogger.behavior("test_event_no_data");
  await EWE.testing.serverLogger.warn("test_event_no_data");

  await EWE.testing.altServerLogger.debug("test_event_no_data");
  await EWE.testing.altServerLogger.info("test_event_no_data");
  await EWE.testing.altServerLogger.behavior("test_event_no_data");
  await EWE.testing.altServerLogger.warn("test_event_no_data");
}

function getConsoleLogs() {
  // eslint-disable-next-line no-console
  return console.log.getCalls().map(item => item.args);
}

async function setRemoteConfig(config, status = 200) {
  await setEndpointResponse(REMOTE_CONFIG_URL, JSON.stringify(config), "GET", status);
}

describe("Telemetry - Server Logging", function() {
  describe("Logger", function() {
    let sandbox;

    beforeEach(function() {
      sandbox = sinon.createSandbox();
      sandbox.spy(console, "log");
    });

    afterEach(async function() {
      sandbox.restore();
      await EWE.telemetry.resetConsoleLogLevel();
    });

    async function expectConsoleLogs({expected = [], unexpected = []}) {
      function addCommonData(logs) {
        return logs.map(log => ["Background (log):",
                                expect.stringMatching(ISO_DATE_REGEX), ...log]);
      }

      const fullExpectedLogs = addCommonData(expected);
      const fullUnexpectedLogs = addCommonData(unexpected);

      await waitForAssertion(() => {
        if (fullExpectedLogs.length > 0) {
          expect(getConsoleLogs()).toEqual(
            expect.arrayContaining(fullExpectedLogs)
          );
        }

        if (fullUnexpectedLogs.length > 0) {
          expect(getConsoleLogs()).toEqual(
            expect.not.arrayContaining(fullUnexpectedLogs)
          );
        }
      });
    }

    for (const [level, acceptedLevels] of acceptedLevelsByLevel) {
      it(`Logs accepted levels for log level: ${level} [fuzz]`, async function() {
        await EWE.telemetry.setConsoleLogLevel(level);

        await EWE.testing.serverLogger.debug("test_event", {level});
        await EWE.testing.serverLogger.info("test_event", {level});
        await EWE.testing.serverLogger.behavior("test_event", {level});
        await EWE.testing.serverLogger.warn("test_event", {level});

        function convertLevelToMatcher(assertedLevel) {
          return [
            module1,
            assertedLevel,
            "test_event",
            {level}
          ];
        }

        await expectConsoleLogs({
          expected: acceptedLevels.map(convertLevelToMatcher),
          unexpected: Array.from(acceptedLevelsByLevel.keys())
            .filter(filterLevel => !acceptedLevels.includes(filterLevel))
            .map(convertLevelToMatcher)
        });
      });
    }

    it("Logs accepted events per module", async function() {
      await EWE.telemetry.setConsoleLogLevel("warn", module1);
      await EWE.testing.serverLogger.warn("test_event", {});
      await EWE.testing.altServerLogger.warn("test_event", {});

      await expectConsoleLogs({
        expected: [[module1, "warn", "test_event", {}]],
        unexpected: [[module2, "warn", "test_event", {}]]
      });

      await EWE.telemetry.setConsoleLogLevel("debug", module2);
      await EWE.testing.altServerLogger.warn("test_event", {});

      await expectConsoleLogs({
        expected: [[module2, "warn", "test_event", {}]]
      });
    });

    it("Logs at the appropriate level when the global config is more verbose", async function() {
      await EWE.telemetry.setConsoleLogLevel("warn", module1);
      await EWE.telemetry.setConsoleLogLevel("debug");

      await EWE.testing.serverLogger.debug("test_event_no_data");
      await EWE.testing.serverLogger.warn("test_event_no_data");
      await EWE.testing.altServerLogger.debug("test_event_no_data");
      await EWE.testing.altServerLogger.warn("test_event_no_data");

      await expectConsoleLogs({
        expected: [
          [module1, "debug", "test_event_no_data"],
          [module1, "warn", "test_event_no_data"],
          [module2, "debug", "test_event_no_data"],
          [module2, "warn", "test_event_no_data"]
        ],
        unexpected: []
      });
    });

    it("Logs at the appropriate level when the module config is more verbose", async function() {
      await EWE.telemetry.setConsoleLogLevel("debug", module1);
      await EWE.telemetry.setConsoleLogLevel("warn");

      await EWE.testing.serverLogger.debug("test_event_no_data");
      await EWE.testing.serverLogger.warn("test_event_no_data");
      await EWE.testing.altServerLogger.debug("test_event_no_data");
      await EWE.testing.altServerLogger.warn("test_event_no_data");

      await expectConsoleLogs({
        expected: [
          [module1, "debug", "test_event_no_data"],
          [module1, "warn", "test_event_no_data"],
          [module2, "warn", "test_event_no_data"]
        ],
        unexpected: [
          [module2, "debug", "test_event_no_data"]
        ]
      });
    });

    it("Logs all the various data types", async function() {
      await EWE.telemetry.setConsoleLogLevel("warn");
      await EWE.testing.serverLogger.warn("test_event_no_data");
      await EWE.testing.serverLogger.warn("test_event", null);
      await EWE.testing.serverLogger.warn("test_event", true);
      await EWE.testing.serverLogger.warn("test_event", 1);
      await EWE.testing.serverLogger.warn("test_event", "yoooooo");
      await EWE.testing.serverLogger.warn("test_event", {vegetable: "potato"});
      await EWE.testing.serverLogger.warn("test_event", ["badger", "badger", "mushroom"]);

      await expectConsoleLogs({
        expected: [
          [module1, "warn", "test_event_no_data"],
          [module1, "warn", "test_event", null],
          [module1, "warn", "test_event", true],
          [module1, "warn", "test_event", 1],
          [module1, "warn", "test_event", "yoooooo"],
          [module1, "warn", "test_event", {vegetable: "potato"}],
          [module1, "warn", "test_event", ["badger", "badger", "mushroom"]]
        ]
      });
    });

    it("Logs from a content script", async function() {
      await EWE.telemetry.setConsoleLogLevel("debug", contentScriptModule);
      await new Page("experiments-content-api.html").loaded;

      await expectConsoleLogs({
        expected: [
          [contentScriptModule, "debug", "test_got_experiment_flag", {flagName: "onboarding_flow", flag: null}]
        ]
      });
    });

    it("Logs from a UI page", async function() {
      await EWE.telemetry.setConsoleLogLevel("debug", uiPageModule);

      function handleConnect(port) {
        if (port.name !== "telemetry-test") {
          return;
        }

        browser.runtime.onConnect.removeListener(handleConnect);
        port.postMessage({type: "debug", data: {some: "data"}});
      }

      browser.runtime.onConnect.addListener(handleConnect);
      const tab = await browser.tabs.create({url: "telemetry-test.html"});

      await expectConsoleLogs({
        expected: [
          [uiPageModule, "debug", "test_message_received", {some: "data"}]
        ]
      });

      await browser.tabs.remove(tab.id);
    });
  });

  describe("Server Uploader", function() {
    async function restartWithTestArgs() {
      await EWE.testing.resetServerLogUploader();
      await EWE.testing.startServerLogUploader({
        url: DEBUG_TELEMETRY_URL,
        bearer: DEBUG_TELEMETRY_BEARER
      }, INTERVAL_BETWEEN_BATCHES, ERROR_DELAY);

      const testingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          global: "debug",
          mods: [0, 1000]
        }
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();
    }

    beforeEach(async function() {
      await EWE.telemetry.setOptOut(false);

      await restartWithTestArgs();
    });

    afterEach(async function() {
      await clearEndpointResponse(DEBUG_TELEMETRY_URL);
      await clearRequestLogs();
      await EWE.experiments.clearFlagOverrides();
    });

    it("does not ping when both url and bearer token aren't provided", async function() {
      await expect(
        EWE.testing.startServerLogUploader({url: DEBUG_TELEMETRY_URL})
      ).rejects.toThrow("Error: No debug telemetry `bearer` provided");
      await expect(
        EWE.testing.startServerLogUploader({bearer: DEBUG_TELEMETRY_BEARER})
      ).rejects.toThrow("Error: No debug telemetry `url` provided");
    });

    it("does not send a behavior log to the server if opted out", async function() {
      await EWE.telemetry.setOptOut(true);
      await EWE.testing.serverLogger.behavior("test_event_no_data");

      await new Promise(r => setTimeout(r, 1000));

      let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
      expect(requestLogs).toHaveLength(0);
    });

    it("sends a behavior log to the server", async function() {
      await EWE.testing.serverLogger.behavior("test_event_no_data");
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs).toHaveLength(1);

        let payloadItems = requestLogs[0].body.payload.items;
        expect(payloadItems).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event_no_data"
        }]);
      });
    });

    it("sends a behavior log with metadata included", async function() {
      await EWE.testing.serverLogger.behavior("test_event_no_data");

      let requestLogs;
      await waitForAssertion(async() => {
        requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs).toHaveLength(1);
      });

      let payload = requestLogs[0].body.payload;
      expect(payload).toHaveProperty("rotating_client_id");
      expect(payload).toHaveProperty("utid");
      expect(payload).toHaveProperty("error_count", 0);
      expect(payload).toHaveProperty("items");
      expect(payload.items).toHaveLength(1);

      expect(payload.platform).toEqual(expect.oneOf(["win", "Windows", "mac", "macOS", "linux", "Linux"]));
      if (payload.platform_version) {
        expect(payload.platform_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      }

      expect(payload.application)
        .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
      expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));

      expect(payload.aa_active).toEqual(false);

      expect(payload.extension_name).toEqual("EWE Test");
      expect(payload.extension_version).toMatch(/0\.0\.\d/);

      expect(payload).not.toHaveProperty("premium_status");
      expect(payload).not.toHaveProperty("addon_name");
      expect(payload).not.toHaveProperty("addon_version");

      expect(Array.isArray(payload.experiments)).toBe(true);
      expect(payload.experiments).toEqual([]);

      expect(Array.isArray(payload.cohorts)).toBe(true);
      expect(payload.cohorts).toEqual([]);
    });

    it("logs added while sending is in progress go into the next batch", async function() {
      let count = 10;

      let expectedItems = [];
      for (let i = 0; i < count; i++) {
        await EWE.testing.serverLogger.behavior("test_event", i);
        expectedItems.push({
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: i
        });
      }

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThan(1);

        let payloadItems = [];
        for (let requestLog of requestLogs) {
          expect(requestLog.body.payload.items.length)
            .toBeGreaterThanOrEqual(1);
          payloadItems.push(...requestLog.body.payload.items);
        }

        expect(payloadItems).toEqual(expectedItems);

        expect(requestLogs[0].body.payload.utid)
          .not.toEqual(requestLogs[1].body.payload.utid);
        expect(requestLogs[0].body.payload.error_count).toBe(0);
        expect(requestLogs[1].body.payload.error_count).toBe(0);

        expect(await getRequestLogIntervals())
          .toEqual([INTERVAL_BETWEEN_BATCHES]);
      }, INTERVAL_BETWEEN_BATCHES * 3);
    });

    it("logs added before the uploader is initialized are sent when the uploader is initialized", async function() {
      await EWE.testing.stopServerLogUploader();

      await EWE.testing.serverLogger.behavior("test_event", 1);
      await EWE.testing.serverLogger.behavior("test_event", 2);
      await EWE.testing.serverLogger.behavior("test_event", 3);

      await EWE.testing.startServerLogUploader({
        url: DEBUG_TELEMETRY_URL,
        bearer: DEBUG_TELEMETRY_BEARER
      });

      // If the uploader were running, this would be split into multiple batches
      // like the previous test case. In this test case however, we expect that
      // all of them are batched together when the system starts.
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs).toHaveLength(1);
        let payloadItems = requestLogs[0].body.payload.items;

        expect(payloadItems).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: 1
        }, {
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: 2
        }, {
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: 3
        }]);
      });
    });

    it("logs that have failed are retried", async function() {
      await setEndpointResponse(DEBUG_TELEMETRY_URL, {}, "POST", 500);

      await EWE.testing.serverLogger.behavior("test_event", "error_retry");

      await new Promise(r => setTimeout(r, ERROR_DELAY));

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThanOrEqual(2);

        let firstPayloadItems = requestLogs[0].body.payload.items;
        let secondPayloadItems = requestLogs[1].body.payload.items;

        expect(requestLogs[0].body.payload.utid)
          .toEqual(requestLogs[1].body.payload.utid);
        expect(requestLogs[0].body.payload.error_count).toBe(0);
        expect(requestLogs[1].body.payload.error_count).toBe(1);

        expect(firstPayloadItems).toEqual(secondPayloadItems);
        expect(await getRequestLogIntervals()).toEqual([ERROR_DELAY]);
      });
    });

    it("logging goes back to normal when services are restored", async function() {
      setMinTimeout(this, 15000);
      await setEndpointResponse(DEBUG_TELEMETRY_URL, {}, "POST", 500);

      await EWE.testing.serverLogger.behavior("test_event", "error_retry_back_to_normal");

      let failedRequestCount;
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThanOrEqual(1);
        failedRequestCount = requestLogs.length;
      });

      await clearEndpointResponse(DEBUG_TELEMETRY_URL);

      await new Promise(r =>
        setTimeout(r, ERROR_DELAY + INTERVAL_BETWEEN_BATCHES)
      );

      let backToNormalRequestCount;
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThan(failedRequestCount);
        backToNormalRequestCount = requestLogs.length;
      });

      await EWE.testing.serverLogger.behavior("test_event", "error_retry_back_to_normal_2");

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);

        expect(requestLogs.length).toBeGreaterThan(backToNormalRequestCount);

        let latestPayload = requestLogs[requestLogs.length - 1].body.payload;
        expect(latestPayload.error_count).toBe(0);
        expect(latestPayload.utid).not.toEqual(
          requestLogs[0].body.payload.utid
        );
        expect(latestPayload.items).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: "error_retry_back_to_normal_2"
        }]);
      });
    });

    it("discards logs after a retry attempt limit has been reached", async function() {
      setMinTimeout(this, 8000);
      await setEndpointResponse(DEBUG_TELEMETRY_URL, {}, "POST", 500);

      await EWE.testing.serverLogger.behavior("test_event", "error_retry_discard");

      await waitForAssertion(async() => {
        const requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBe(ERROR_RETRY_ATTEMPTS);

        const firstUtid = requestLogs[0].body.payload.utid;
        requestLogs.forEach((log, index) => {
          expect(log.body.payload.utid).toBe(firstUtid);
          expect(log.body.payload.error_count).toBe(index);
        });
      }, ERROR_DELAY * ERROR_RETRY_ATTEMPTS);

      await clearEndpointResponse(DEBUG_TELEMETRY_URL);
      await EWE.testing.serverLogger.behavior("test_event", "new_log_after_discard");

      await waitForAssertion(async() => {
        const requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        const lastLog = requestLogs[requestLogs.length - 1];

        expect(lastLog.body.payload.error_count).toBe(0);
        expect(lastLog.body.payload.utid).not.toEqual(
          requestLogs[0].body.payload.utid
        );
      });
    });

    it("logs can be appended to a batch when there are failures", async function() {
      await setEndpointResponse(DEBUG_TELEMETRY_URL, {}, "POST", 500);

      await EWE.testing.serverLogger.behavior("test_event", "extra_logs_on_error_1");
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs).toHaveLength(1);
      });

      await EWE.testing.serverLogger.behavior("test_event", "extra_logs_on_error_2");

      await new Promise(r => setTimeout(r, ERROR_DELAY));

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThanOrEqual(2);

        let firstPayload = requestLogs[0].body.payload;
        let firstPayloadItems = firstPayload.items;
        let secondPayload = requestLogs[1].body.payload;
        let secondPayloadItems = secondPayload.items;

        expect(firstPayload.error_count).toBe(0);
        expect(secondPayload.error_count).toBe(1);
        expect(firstPayload.utid).toEqual(secondPayload.utid);

        expect(firstPayloadItems).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: "extra_logs_on_error_1"
        }]);

        expect(secondPayloadItems).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: "extra_logs_on_error_1"
        }, {
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: "extra_logs_on_error_2"
        }]);
      });
    });

    it("rotates user ids according to configured period", async function() {
      this.timeout(10000);

      const verifyTelemetryPayload = async(expectedCount = 1) => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs).toHaveLength(expectedCount);
        let payload = requestLogs[expectedCount - 1].body.payload;
        expect(payload).toHaveProperty("rotating_client_id");
        expect(typeof payload.rotating_client_id).toBe("string");
        return payload;
      };

      const TEST_ROTATION_PERIOD = 3000;
      await EWE.testing.setRotationPeriod(TEST_ROTATION_PERIOD);

      // First log should create an initial ID to check the rotation.
      await EWE.testing.serverLogger.behavior("test_event", "test-rotation");
      let initialUserId = null;

      await waitForAssertion(async() => {
        let payload = await verifyTelemetryPayload(1);
        initialUserId = payload.rotating_client_id;
        expect(initialUserId).toBeDefined();
      });

      // If we log again within TEST_ROTATION_PERIOD, the ID should not change.
      await EWE.testing.serverLogger.behavior("test_event", "test-rotation-2");

      await waitForAssertion(async() => {
        let payload = await verifyTelemetryPayload(2);
        expect(payload.rotating_client_id).toBe(initialUserId);
      });

      // Wait long enough to create a new rotating client ID.
      await new Promise(r => setTimeout(r, TEST_ROTATION_PERIOD + 1000));

      // A last test that should have a new client ID.
      await EWE.testing.serverLogger.behavior("test_event", "test-rotation-3");

      await waitForAssertion(async() => {
        let payload = await verifyTelemetryPayload(3);
        expect(payload.rotating_client_id).not.toBe(initialUserId);
        expect(payload.items).toEqual([{
          timestamp: expect.stringMatching(ISO_DATE_REGEX),
          module: module1,
          level: "behavior",
          event: "test_event",
          data: "test-rotation-3"
        }]);
      });

      await EWE.testing.resetRotationPeriod();
    });

    describe("Service worker suspension [mv3-only]", function() {
      setMinTimeout(this, 15000);

      it("does not lose unsent logs when the service worker is suspended", async function() {
        await setEndpointResponse(DEBUG_TELEMETRY_URL, {}, "POST", 500);

        await EWE.testing.serverLogger.behavior(
          "test_event", "service_worker_suspend_1"
        );

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
          expect(requestLogs.length).toBeGreaterThanOrEqual(1);
        });

        await suspendServiceWorker(this);
        await clearEndpointResponse(DEBUG_TELEMETRY_URL);

        await EWE.testing.serverLogger.behavior(
          "test_event", "service_worker_suspend_2"
        );

        // This is necessary to set the error delay to its short test value
        // again. It would be reverted to its default by the service worker
        // suspension. We unfortunately need to wait for it to start with the
        // wrong value before restarting it with the right one, because
        // otherwise we sometimes get race conditions on which value it's
        // started with.
        await wait(() => {
          return EWE.testing.serverLogUploaderIsRunning();
        });
        await EWE.testing.stopServerLogUploader();
        await EWE.testing.startServerLogUploader({
          url: DEBUG_TELEMETRY_URL,
          bearer: DEBUG_TELEMETRY_BEARER
        }, INTERVAL_BETWEEN_BATCHES, ERROR_DELAY);

        await new Promise(r => setTimeout(r, ERROR_DELAY));

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
          expect(requestLogs.length).toBeGreaterThanOrEqual(2);

          let lastLog = requestLogs[requestLogs.length - 1];
          let lastLogItems = lastLog.body.payload.items;

          const firstClientId = requestLogs[0].body.payload.rotating_client_id;
          const lastClientId = lastLog.body.payload.rotating_client_id;

          expect(firstClientId).toEqual(lastClientId);

          expect(lastLogItems).toEqual([{
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module1,
            level: "behavior",
            event: "test_event",
            data: "service_worker_suspend_1"
          }, {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module1,
            level: "behavior",
            event: "test_event",
            data: "service_worker_suspend_2"
          }]);
        });
      });
    });
  });

  describe("Integration", function() {
    beforeEach(async function() {
      await clearRequestLogs();
      await EWE.telemetry.setOptOut(false);
    });

    afterEach(async function() {
      await EWE.testing.resetServerLogUploader();
      await EWE.testing.startServerLogUploader({
        url: DEBUG_TELEMETRY_URL,
        bearer: DEBUG_TELEMETRY_BEARER
      });
    });

    it("can successfully send a payload to the eyeometry staging server", async function() {
      setMinTimeout(this, 11000);

      let loggerArgs = {
        url: webpackDotenvPlugin.EWE_SERVER_LOG_URL,
        bearer: webpackDotenvPlugin.EWE_SERVER_LOG_BEARER
      };
      if (!loggerArgs.url || !loggerArgs.bearer) {
        this.skip();
      }

      await EWE.testing.resetServerLogUploader();
      await EWE.testing.startServerLogUploader(loggerArgs);

      await EWE.testing.serverLogger.behavior("test_event",
                                              {test: true, foo: "bar"});

      await waitForAssertion(async() => {
        let storageResult =
            await browser.storage.local.get([UPLOADER_STORAGE_KEY]);
        let storage = storageResult[UPLOADER_STORAGE_KEY];

        expect(storage).toHaveProperty("lastSuccess");
        expect(storage).not.toHaveProperty("lastError");
      }, 5000);
    });
  });

  describe("Remote configuration", function() {
    beforeEach(async function() {
      await clearRequestLogs();
      await EWE.telemetry.setOptOut(false);

      await EWE.testing.resetServerLogUploader();
      await EWE.testing.startServerLogUploader({
        url: DEBUG_TELEMETRY_URL,
        bearer: DEBUG_TELEMETRY_BEARER
      }, INTERVAL_BETWEEN_BATCHES, ERROR_DELAY);
    });

    afterEach(async function() {
      await clearEndpointResponse(DEBUG_TELEMETRY_URL);
      await clearRequestLogs();
      await EWE.experiments.clearFlagOverrides();
    });

    const KNOWN_CLIENT_IDS = {
      LOWER_HALF: "f47ac10b-58cc-4372-a567-0e02b2c3d479", // 308
      UPPER_HALF: "e5c619b9-7928-4d4a-b25d-84e5df2080c2" // 767
    };

    it("Does not log if there is no logging config", async function() {
      const testingConfig = {
        schemaId: "1",
        experiments: []
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();

      await logAllEvents();

      await new Promise(r => setTimeout(r, 2000));
      const noLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
      expect(noLogs).toHaveLength(0);
    });

    it("Logs based on a given global server configuration", async function() {
      const testingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          global: "warn",
          mods: [0, 1000]
        }
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();

      await logAllEvents();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);

        let payloadItems = [];
        for (let requestLog of requestLogs) {
          payloadItems.push(...requestLog.body.payload.items);
        }

        expect(payloadItems).toHaveLength(2);

        expect(payloadItems).toEqual(expect.arrayContaining([
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module1,
            level: "warn",
            event: "test_event_no_data"
          },
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module2,
            level: "warn",
            event: "test_event_no_data"
          }
        ]));
      }, INTERVAL_BETWEEN_BATCHES * 3);
    });

    it("Logs based on a given per module server configuration", async function() {
      const testingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          byModule: {
            test_ewe_background: "behavior",  // Only behavior and warn should log
            test_ewe_ui_api: "debug"          // All levels should log
          },
          mods: [0, 1000]
        }
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();

      await logAllEvents();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);

        let payloadItems = [];
        for (let requestLog of requestLogs) {
          payloadItems.push(...requestLog.body.payload.items);
        }

        // Should have 2 logs from module1 (behavior, warn)
        // and 4 from module2 (all levels)
        expect(payloadItems).toHaveLength(6);

        const module1Logs = payloadItems.filter(x => x.module === module1);
        expect(module1Logs).toHaveLength(2);
        expect(module1Logs).toEqual(expect.arrayContaining([
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module1,
            level: "behavior",
            event: "test_event_no_data"
          },
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module1,
            level: "warn",
            event: "test_event_no_data"
          }
        ]));

        const module2Logs = payloadItems.filter(x => x.module === module2);
        expect(module2Logs).toHaveLength(4);
        expect(module2Logs).toEqual(expect.arrayContaining([
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module2,
            level: "debug",
            event: "test_event_no_data"
          },
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module2,
            level: "info",
            event: "test_event_no_data"
          },
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module2,
            level: "behavior",
            event: "test_event_no_data"
          },
          {
            timestamp: expect.stringMatching(ISO_DATE_REGEX),
            module: module2,
            level: "warn",
            event: "test_event_no_data"
          }
        ]));
      }, INTERVAL_BETWEEN_BATCHES * 3);
    });

    it("Logs based on a user being in a specific mod range", async function() {
      const testingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          global: "warn",
          mods: [0, 500]
        }
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();

      const inRangeClientId = KNOWN_CLIENT_IDS.LOWER_HALF;
      await EWE.testing.setRotatingClientId(inRangeClientId);

      await EWE.testing.serverLogger.warn("test_event_no_data");

      await waitForAssertion(async() => {
        const requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThan(0);

        const payload = requestLogs[0].body.payload;
        expect(payload.rotating_client_id).toBe(inRangeClientId);
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0]).toMatchObject({
          module: module1,
          level: "warn",
          event: "test_event_no_data"
        });
      }, INTERVAL_BETWEEN_BATCHES * 3);

      await clearRequestLogs();

      const outOfRangeClientId = KNOWN_CLIENT_IDS.UPPER_HALF;
      await EWE.testing.setRotatingClientId(outOfRangeClientId);

      await EWE.testing.serverLogger.warn("test_event_no_data");

      await new Promise(r => setTimeout(r, 2000));
      const noLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
      expect(noLogs).toHaveLength(0);
    });

    it("Stops logging when the server changes remote config's mod ranges", async function() {
      const testingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          global: "warn",
          mods: [0, 500]
        }
      };

      await setRemoteConfig(testingConfig);
      await EWE.remoteConfig.sync();

      const inRangeClientId = KNOWN_CLIENT_IDS.LOWER_HALF;
      await EWE.testing.setRotatingClientId(inRangeClientId);

      await EWE.testing.serverLogger.warn("test_event_no_data");

      await waitForAssertion(async() => {
        const requestLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
        expect(requestLogs.length).toBeGreaterThan(0);

        const payload = requestLogs[0].body.payload;
        expect(payload.rotating_client_id).toBe(inRangeClientId);
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0]).toMatchObject({
          module: module1,
          level: "warn",
          event: "test_event_no_data"
        });
      }, INTERVAL_BETWEEN_BATCHES * 3);

      const updatedTestingConfig = {
        schemaId: "1",
        experiments: [],
        loggingLevels: {
          global: "warn",
          mods: [0, 100]
        }
      };

      await setRemoteConfig(updatedTestingConfig);
      await EWE.remoteConfig.sync();

      await clearRequestLogs();

      await EWE.testing.serverLogger.warn("test_event_no_data");

      await new Promise(r => setTimeout(r, 2000));
      const noLogs = await getRequestLogs(DEBUG_TELEMETRY_URL);
      expect(noLogs).toHaveLength(0);
    });
  });
});
