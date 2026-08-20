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

import expect from "expect";
import sinon from "sinon/pkg/sinon.js";
import {clearTestEvents, EWE, expectTestEvents} from "./messaging.js";
import {ISO_DATE_REGEX, waitForAssertion} from "./utils.js";
import {defaultFacts, cohortsConfig, cohort1Config, cohort2Config, filterListsCohortConfig, filterListsExcludeCohortConfig, filterListsHash} from "./fixtures/cohorts.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {DEFAULT_CONFIG, setConfig} from "./fixtures/remote-config.js";

const countryCode = "US";

describe("Cohorts", function() {
  beforeEach(async function() {
    await EWE.testing.mockFacts(defaultFacts);
    await EWE.testing.resetRemoteConfig();
    await EWE.testing.resetCohortsData();
  });

  it("returns an empty state before first sync", async function() {
    expect(await EWE.remoteConfig.getConfig()).toBeUndefined();
    expect(await EWE.remoteConfig.getCohortsConfig()).toEqual([]);
    expect(await EWE.cohorts.getAll()).toEqual([]);
  });

  it("returns the cohorts assigned", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, countryCode);
    await EWE.cohorts.sync();

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toHaveLength(2);
    expect(cohorts).toEqual(expect.arrayContaining([
      cohort1Config.event.type,
      cohort2Config.event.type
    ]));
  });

  it("returns the cohorts as a base64-encoded bitmap", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, countryCode);
    await EWE.cohorts.sync();
    let encoded = await EWE.cohorts.getEncodedCohorts();
    expect(encoded).toEqual("Aw==");

    await EWE.testing.resetCohortsData();
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, "FR");
    await EWE.cohorts.sync();
    encoded = await EWE.cohorts.getEncodedCohorts();
    expect(encoded).toEqual("Ag==");

    await EWE.testing.resetCohortsData();
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, "RO");
    await EWE.cohorts.sync();
    encoded = await EWE.cohorts.getEncodedCohorts();
    expect(encoded).toEqual("AQ==");

    await EWE.testing.resetRemoteConfig();
    await EWE.testing.resetCohortsData();
    encoded = await EWE.cohorts.getEncodedCohorts();
    expect(encoded).toEqual("AA==");
  });

  it("returns the correct cohorts encoding after SW restart [mv3-only]", async function() {
    const remoteConfig = {
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    };

    // IMPORTANT: we want here to test the full flow,
    // aka not mocking the remote config
    await setConfig(remoteConfig, 200, "", countryCode);
    await EWE.remoteConfig.sync();

    const expectedEncoding = "Aw=="; // cohort1 + cohort2
    const beforeEncoded = await EWE.cohorts.getEncodedCohorts();
    expect(beforeEncoded).toEqual(expectedEncoding);

    await suspendServiceWorker(this);

    const afterEncoded = await EWE.cohorts.getEncodedCohorts();
    expect(afterEncoded).toEqual(expectedEncoding);
  });

  it("updates cohorts when facts change", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, countryCode);
    await EWE.cohorts.sync();

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toHaveLength(2);
    expect(cohorts).toEqual(expect.arrayContaining([
      cohort1Config.event.type,
      cohort2Config.event.type
    ]));

    await EWE.testing.mockFacts({
      ...defaultFacts,
      hasPremium: true // Change premium status to not match cohort1
    });
    await EWE.cohorts.sync();

    const updatedCohorts = await EWE.cohorts.getAll();
    expect(updatedCohorts).toEqual([
      cohort2Config.event.type
    ]);
  });

  it("assigns the right cohorts based on facts", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, "FR");
    await EWE.cohorts.sync();

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toEqual([cohort2Config.event.type]);
  });

  it("assigns cohort when filterLists contains the expected hash", async function() {
    await EWE.testing.mockFacts({
      ...defaultFacts, filterLists: [filterListsHash]
    });
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: [filterListsCohortConfig]
    }, countryCode);
    await EWE.cohorts.sync();

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toEqual([filterListsCohortConfig.event.type]);
  });

  it("assigns cohort when filterLists doesNotContain the expected hash", async function() {
    await EWE.testing.mockFacts({
      ...defaultFacts, filterLists: ["000000000000"]
    });
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: [filterListsExcludeCohortConfig]
    }, countryCode);
    await EWE.cohorts.sync();

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toEqual([filterListsExcludeCohortConfig.event.type]);
  });

  it("clears old cohorts when new config is empty", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, countryCode);
    await EWE.cohorts.sync();
    expect(await EWE.cohorts.getAll()).toHaveLength(2);

    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: []
    }, countryCode);
    await EWE.cohorts.sync();
    expect(await EWE.cohorts.getAll()).toEqual([]);
  });

  describe("Missing facts or operators", function() {
    it("does not throw error when fact is missing and ignores the config", async function() {
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        cohorts: [
          cohort2Config,
          {
            name: "Missing fact cohort",
            conditions: {
              all: [
                {
                  fact: "nonExistentFact", // This fact does not exist
                  operator: "equal",
                  value: "someValue"
                }
              ]
            },
            event: {
              type: "missing_fact"
            }
          }
        ]
      }, countryCode);
      await EWE.cohorts.sync();

      const cohorts = await EWE.cohorts.getAll();
      expect(cohorts).toEqual([cohort2Config.event.type]);
    });

    it("does not throw error when operator is missing and ignores the config", async function() {
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        cohorts: [
          cohort2Config,
          {
            name: "Missing operator cohort",
            conditions: {
              all: [
                {
                  fact: "countryCode",
                  operator: "nonExistentOperator", // This operator does not exist
                  value: ["US"]
                }
              ]
            },
            event: {
              type: "missing_operator"
            }
          }
        ]
      }, countryCode);
      await EWE.cohorts.sync();

      const cohorts = await EWE.cohorts.getAll();
      expect(cohorts).toEqual([cohort2Config.event.type]);
    });
  });

  it("returns false for includes if not in cohort", async function() {
    await EWE.testing.mockRemoteConfig({
      ...DEFAULT_CONFIG,
      cohorts: cohortsConfig
    }, countryCode);
    await EWE.cohorts.sync();
    expect(await EWE.cohorts.includes("non_existent_cohort")).toBe(false);
  });

  describe("Facts snapshot reporting", function() {
    let sandbox;
    const expectedFacts = {
      ...defaultFacts,
      aaEnabled: expect.any(Boolean),
      browserLanguage: expect.any(String),
      browserName: expect.any(String),
      browserVersion: expect.stringMatching(/^\d+(\.\d+)*$/),
      countryCode: expect.stringMatching(/^[A-Z]{2}$/),
      extName: expect.any(String),
      extVersion: expect.stringMatching(/^\d+(\.\d+)*$/),
      installType: "development",
      dynamicRuleCount: expect.any(Number),
      staticRuleCount: expect.any(Number),
      filterLists: expect.any(Array),
      clientIdStability: expect.any(Number),
      clientIdRotationFrequency: expect.any(Number)
    };

    beforeEach(async function() {
      // Set logging level globally
      await EWE.telemetry.setConsoleLogLevel("debug");

      sandbox = sinon.createSandbox();
      sandbox.spy(console, "log");
    });

    afterEach(async function() {
      sandbox.restore();
      await EWE.telemetry.resetConsoleLogLevel();
    });

    function getConsoleLogs() {
      // eslint-disable-next-line no-console
      return console.log.getCalls().map(item => item.args);
    }

    async function expectConsoleLogs(expected = []) {
      function addCommonData(logs) {
        return logs.map(log => [
          "Background (log):",
          expect.stringMatching(ISO_DATE_REGEX),
          ...log
        ]);
      }

      const fullExpectedLogs = addCommonData(expected);

      await waitForAssertion(() => {
        expect(getConsoleLogs()).toEqual(
          expect.arrayContaining(fullExpectedLogs)
        );
      });
    }

    it("sends an event if first time or more than 12h have passed", async function() {
      // Sync cohorts to trigger the first facts snapshot
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        cohorts: cohortsConfig
      }, countryCode);
      await EWE.cohorts.sync();

      // Expect the facts snapshot to be logged
      await expectConsoleLogs([
        ["cohorts", "info", "facts_snapshot", expectedFacts]
      ]);
    });

    it("does not send the event if too early", async function() {
      // Sync cohorts to trigger the first facts snapshot
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        cohorts: cohortsConfig
      }, countryCode);
      await EWE.cohorts.sync();

      // Expect the facts snapshot to be logged
      await expectConsoleLogs([
        ["cohorts", "info", "facts_snapshot", expectedFacts]
      ]);

      // Reset the console logs and sync again
      await EWE.testing._clearDebugLog();
      await EWE.cohorts.sync();
      await EWE.testing._printDebugLog();

      // Expect no new facts snapshot to be logged
      await waitForAssertion(() => {
        expect(getConsoleLogs()).toEqual(
          expect.arrayContaining([
            expect.arrayContaining([
              "Background (debug):",
              expect.stringContaining("[cohorts] No changes in facts, skipping cohort evaluation")
            ])
          ])
        );
      });
    });
  });

  describe("Cohorts events", function() {
    beforeEach(async function() {
      await clearTestEvents("cohorts.updated");
    });

    it("fires an onChanged event when cohorts are updated", async function() {
      await expectTestEvents("cohorts.updated", []);
      expect(await EWE.cohorts.getAll()).toEqual([]);

      // Sync with country code set to FR to trigger ONLY cohort2
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        cohorts: cohortsConfig
      }, "FR");
      await EWE.cohorts.sync();
      await expectTestEvents("cohorts.updated", [[[cohort2Config.event.type]]]);
    });
  });
});
