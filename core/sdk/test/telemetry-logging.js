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
import {Page, waitForAssertion, ISO_DATE_REGEX} from "./utils.js";

const acceptedLevelsByLevel = new Map([
  ["off", []],
  ["warn", ["warn"]],
  ["behavior", ["warn", "behavior"]],
  ["info", ["warn", "behavior", "info"]],
  ["debug", ["warn", "behavior", "info", "debug"]]
]);

const module1 = "ewe_background_test";
const module2 = "ewe_background_test_alternate";
const contentScriptModule = "ewe_content_api_test";
const uiPageModule = "ewe_ui_api_test";

function getConsoleLogs() {
  // eslint-disable-next-line no-console
  return console.log.getCalls().map(item => item.args);
}

describe("Telemetry - Debug Logging", function() {
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
