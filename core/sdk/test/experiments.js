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

import {EWE, expectTestEvents, clearTestEvents} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {
  Page,
  clearEndpointResponse,
  clearRequestLogs,
  getRequestLogs,
  setEndpointResponse,
  setMinTimeout,
  waitForAssertion,
  getExistingElement
} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";
import {wait} from "./polling.js";

const EXPERIMENT_FLAG = "onboarding_flow";
const EXPERIMENT_URL = `${TEST_ADMIN_PAGES_URL}/experiments.json`;

const EXPERIMENT_ID = "experiment-1";
const LOWER_VARIANT_ID = "lower-variant";
const UPPER_VARIANT_ID = "upper-variant";
const LOWER_VARIANT_FLAG = LOWER_VARIANT_ID + "-flag";
const UPPER_VARIANT_FLAG = UPPER_VARIANT_ID + "-flag";
const LOWER_HALF_USER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";  // Hashes with experimentid-1 to 215
const UPPER_HALF_USER_ID = "e5c619b9-7928-4d8a-b25c-84e5df2080c2";  // Hashes with experimentid-1 to 907
const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
const SCHEMA_ID = "1";
const ERROR_BACKOFF_MS = 2 * MILLIS_IN_SECOND;
const PING_INTERVAL_MS = MILLIS_IN_SECOND;

function oneVariantConfig(flag) {
  return JSON.stringify({
    schemaId: SCHEMA_ID,
    experiments: [{
      experimentId: EXPERIMENT_ID,
      variants: [{
        variantId: "variant1",
        flags: {[EXPERIMENT_FLAG]: flag},
        mods: [0, 1000]
      }]
    }]
  });
}

function twoVariantConfig(lowerMods, upperMods) {
  return JSON.stringify({
    schemaId: SCHEMA_ID,
    experiments: [{
      experimentId: EXPERIMENT_ID,
      variants: [
        {
          variantId: LOWER_VARIANT_ID,
          flags: {[EXPERIMENT_FLAG]: LOWER_VARIANT_FLAG},
          mods: lowerMods
        },
        {
          variantId: UPPER_VARIANT_ID,
          flags: {
            [EXPERIMENT_FLAG]: UPPER_VARIANT_FLAG,
            "Second flag": "second flag value"
          },
          mods: upperMods
        }
      ]
    }]
  });
}

async function setConfig(config, status = 200, etag) {
  await setEndpointResponse(EXPERIMENT_URL, config, "GET", status, {etag});
}

async function startWithTestArgs(disableAutosync) {
  await EWE.testing.restartExperiments(
    EXPERIMENT_URL, PING_INTERVAL_MS, ERROR_BACKOFF_MS, disableAutosync
  );
}

describe("Split Experiments", function() {
  afterEach(async function() {
    await clearEndpointResponse(EXPERIMENT_URL);
    await EWE.experiments.clearFlagOverrides();
    await startWithTestArgs(true);
  });

  it("returns an empty state before first sync", async function() {
    await EWE.testing.resetExperimentData();

    expect(await EWE.experiments.getAssignments()).toEqual({});
    expect(await EWE.experiments.getExperiments()).toEqual([]);
    expect(await EWE.experiments.getRevisionId()).toBeNull();
    expect(await EWE.experiments.getSyncStatus()).toEqual({
      errors: []
    });
  });

  it("returns revision ID", async function() {
    await EWE.experiments.sync();

    // Hash corresponding to {"schemaId":"1","experiments":[]}
    expect(await EWE.experiments.getRevisionId()).toEqual("BpNHg1PA");
  });

  it("initially returns an empty object for get all flags", async function() {
    await EWE.testing.resetExperimentData();
    let flags = await EWE.experiments.getFlags();
    expect(flags).toEqual({});
  });

  describe("Variant assignment", function() {
    it("initially returns null for a flag", async function() {
      let flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
      expect(flag).toBeNull();
    });

    it("can override and retrieve a flag value", async function() {
      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("potato");

      let flags = await EWE.experiments.getFlags();
      expect(flags).toEqual({
        [EXPERIMENT_FLAG]: "potato"
      });
    });

    it("returns experiments with assignments", async function() {
      await setConfig(oneVariantConfig("test"));
      await EWE.experiments.sync();

      expect(await EWE.experiments.getExperiments()).toEqual([
        {
          id: EXPERIMENT_ID,
          variants: [
            {
              assigned: true,
              id: "variant1"
            }
          ]
        }
      ]);
    });

    it("returns one flag with value", async function() {
      await setConfig(oneVariantConfig("test"));
      await EWE.experiments.sync();

      let flags = await EWE.experiments.getFlags();
      expect(flags).toEqual({
        [EXPERIMENT_FLAG]: "test"
      });
    });

    it("gets the value of the flag in the experiment the user is assigned to", async function() {
      await setConfig(oneVariantConfig("simple"));

      await EWE.experiments.sync();

      let flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
      expect(flag).toBe("simple");
    });

    it("gets the value of a flag regardless of its type", async function() {
      await setConfig(JSON.stringify({
        schemaId: SCHEMA_ID,
        experiments: [{
          experimentId: "test1",
          variants: [{
            variantId: "variant1",
            flags: {
              string_flag: "value1",
              number_flag: 42,
              array_flag: ["item1", "item2"],
              boolean_flag: true,
              object_flag: {key: "value"}
            },
            mods: [0, 1000]
          }]
        }]
      }));

      await EWE.experiments.sync();

      expect(await EWE.experiments.getFlag("string_flag")).toBe("value1");
      expect(await EWE.experiments.getFlag("number_flag")).toBe(42);
      expect(await EWE.experiments.getFlag("array_flag")).toEqual(["item1", "item2"]);
      expect(await EWE.experiments.getFlag("boolean_flag")).toBe(true);
      expect(await EWE.experiments.getFlag("object_flag")).toEqual({key: "value"});
    });

    it("gets all values for all flags regardless of its type", async function() {
      await setConfig(JSON.stringify({
        schemaId: SCHEMA_ID,
        experiments: [{
          experimentId: "test1",
          variants: [{
            variantId: "variant1",
            flags: {
              string_flag: "value1",
              number_flag: 42,
              array_flag: ["item1", "item2"],
              boolean_flag: true,
              object_flag: {key: "value"}
            },
            mods: [0, 1000]
          }]
        }]
      }));

      await EWE.experiments.sync();
      let flags = await EWE.experiments.getFlags();
      expect(flags).toEqual({
        string_flag: "value1",
        number_flag: 42,
        array_flag: ["item1", "item2"],
        boolean_flag: true,
        object_flag: {key: "value"}
      });
    });

    it("deterministically assigns users to variants based on their seed", async function() {
      await setEndpointResponse(EXPERIMENT_URL,
                                twoVariantConfig([0, 500], [500, 1000]));

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({
        [EXPERIMENT_ID]: LOWER_VARIANT_ID
      });
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
        .toBe(LOWER_VARIANT_FLAG);
      expect(await EWE.experiments.getFlag("Second flag")).toBeNull();

      await EWE.testing.setExperimentsSeed(UPPER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({
        [EXPERIMENT_ID]: UPPER_VARIANT_ID
      });
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
        .toBe(UPPER_VARIANT_FLAG);
      expect(await EWE.experiments.getFlag("Second flag")).toBe("second flag value");
    });

    it("mods are inclusive at the bottom and exclusive at the top", async function() {
      await setEndpointResponse(EXPERIMENT_URL,
                                twoVariantConfig([0, 215], [215, 1000]));

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({
        [EXPERIMENT_ID]: UPPER_VARIANT_ID
      });
    });

    it("doesn't assign to a variant if there isn't a relevant one", async function() {
      await setEndpointResponse(EXPERIMENT_URL,
                                twoVariantConfig([0, 215], [216, 1000]));

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({});
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe(null);
    });

    it("deterministically assigns users to various variants based on their seeds", async function() {
      await setConfig(JSON.stringify({
        schemaId: SCHEMA_ID,
        experiments: [{
          experimentId: EXPERIMENT_ID,
          variants: [
            {
              variantId: "small-variant",
              flags: {[EXPERIMENT_FLAG]: "small-group"},
              mods: [0, 200]
            },
            {
              variantId: "medium-variant",
              flags: {[EXPERIMENT_FLAG]: "medium-group"},
              mods: [200, 500]
            },
            {
              variantId: "large-variant",
              flags: {[EXPERIMENT_FLAG]: "large-group"},
              mods: [500, 1000]
            }
          ]
        }]
      }));

      const testCases = [
        {
          userId: "7d1c0759-0b2d-4a0e-8c75-a86a0c0c1e41", // Hashes with experiment-1 to 62
          expectedVariant: "small-variant",
          expectedFlag: "small-group"
        },
        {
          userId: "5d8c0759-2b2d-4a0e-8c75-a86a0c0c1e43", // Hashes with experiment-1 to 376
          expectedVariant: "medium-variant",
          expectedFlag: "medium-group"
        },
        {
          userId: "ad8c0751-2b2d-5a0e-8c75-a86a0c0c1e43", // Hashes with experiment-1 to 688
          expectedVariant: "large-variant",
          expectedFlag: "large-group"
        }
      ];

      for (const testCase of testCases) {
        await EWE.testing.setExperimentsSeed(testCase.userId);
        await EWE.experiments.sync();

        expect(await EWE.experiments.getAssignments()).toEqual({
          [EXPERIMENT_ID]: testCase.expectedVariant
        });

        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
          .toBe(testCase.expectedFlag);
      }
    });

    it("deterministically assigns users to variants with multiple experiments present based on their seeds", async function() {
      await setConfig(JSON.stringify({
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "experiment-1",
            variants: [
              {
                variantId: "exp1-small",
                flags: {exp1_flag: "small"},
                mods: [0, 200]
              },
              {
                variantId: "exp1-medium",
                flags: {exp1_flag: "medium"},
                mods: [200, 600]
              },
              {
                variantId: "exp1-large",
                flags: {exp1_flag: "large"},
                mods: [600, 1000]
              }
            ]
          },
          {
            experimentId: "experiment-2",
            variants: [
              {
                variantId: "exp2-control",
                flags: {exp2_flag: "control"},
                mods: [0, 100]
              },
              {
                variantId: "exp2-treatment-a",
                flags: {exp2_flag: "treatment-a"},
                mods: [100, 400]
              },
              {
                variantId: "exp2-treatment-b",
                flags: {exp2_flag: "treatment-b"},
                mods: [400, 1000]
              }
            ]
          }
        ]
      }));

      // LOWER_HALF_USER_ID hashes to 215 with experiment-1
      // LOWER_HALF_USER_ID hashes to 775 with experiment-2
      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();

      expect(await EWE.experiments.getAssignments()).toEqual({
        "experiment-1": "exp1-medium",
        "experiment-2": "exp2-treatment-b"
      });

      expect(await EWE.experiments.getFlag("exp1_flag")).toBe("medium");
      expect(await EWE.experiments.getFlag("exp2_flag")).toBe("treatment-b");
    });

    it("assigns a new seed if there isn't one already", async function() {
      await setConfig(JSON.stringify({
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "experiment-1",
            variants: Array.from({length: 1000}, (_v, i) => {
              return {
                variantId: `var-${i}`,
                flags: {mod: i},
                mods: [i, i + 1]
              };
            })
          }
        ]
      }));

      let foundMods = new Set();
      for (let i = 0; i < 5; i++) {
        await EWE.testing.setExperimentsSeed(null);
        await EWE.experiments.sync();
        foundMods.add(await EWE.experiments.getFlag("mod"));
      }

      expect(foundMods.size).toBeGreaterThan(1);
    });

    it("assigns users to the correct variant when increasing the variant's mod range", async function() {
      const userShouldBeInVariant = async(variant, flag) => {
        expect(await EWE.experiments.getAssignments()).toEqual({
          "experiment-1": variant
        });
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe(flag);
      };

      await setEndpointResponse(EXPERIMENT_URL,
                                twoVariantConfig([0, 500], [500, 1000]));

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);

      await EWE.testing.setExperimentsSeed(UPPER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(UPPER_VARIANT_ID, UPPER_VARIANT_FLAG);

      await setEndpointResponse(EXPERIMENT_URL,
                                twoVariantConfig([0, 950], [950, 1000]));

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);

      await EWE.testing.setExperimentsSeed(UPPER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);
    });
  });

  describe("Scheduled updates", function() {
    async function expectNextPing(expectedNewPingCount, expectedFlags) {
      await waitForAssertion(async() => {
        expect(await getRequestLogs(EXPERIMENT_URL))
          .toHaveLength(expectedNewPingCount);

        for (let flag in expectedFlags) {
          expect(await EWE.experiments.getFlag(flag)).toBe(expectedFlags[flag]);
        }
      });
    }

    async function delayThenExpectNextPing(delay, expectedNewPingCount,
                                           expectedFlags) {
      await new Promise(r => setTimeout(r, delay));
      await expectNextPing(expectedNewPingCount, expectedFlags);
    }

    beforeEach(async function() {
      await EWE.testing.resetExperimentData();
      await clearRequestLogs();
    });

    it("updates experiment data on schedule", async function() {
      await setConfig(oneVariantConfig("initial"));
      await startWithTestArgs(false);

      await expectNextPing(1, {[EXPERIMENT_FLAG]: "initial"});
      const initialSyncStatus = await EWE.experiments.getSyncStatus();
      expect(initialSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig(oneVariantConfig("updated"));
      await delayThenExpectNextPing(PING_INTERVAL_MS, 2, {[EXPERIMENT_FLAG]: "updated"});
      const updatedSyncStatus = await EWE.experiments.getSyncStatus();
      expect(updatedSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      expect(updatedSyncStatus.lastDownloaded)
        .not.toBe(initialSyncStatus.lastDownloaded);
    });

    it("waits for the error retry delay if there is a network error", async function() {
      setMinTimeout(this, 10000);

      await setConfig(oneVariantConfig("initial"));
      await startWithTestArgs(false);

      await expectNextPing(1, {[EXPERIMENT_FLAG]: "initial"});
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig({}, 500);
      await delayThenExpectNextPing(PING_INTERVAL_MS, 2, {[EXPERIMENT_FLAG]: "initial"});
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        lastNetworkError: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig(oneVariantConfig("updated"));
      await delayThenExpectNextPing(ERROR_BACKOFF_MS, 3, {[EXPERIMENT_FLAG]: "updated"});
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
    });

    it("pings using the error delay when the service worker is suspended after a server error [mv3-only]", async function() {
      await setConfig({}, 500);
      await startWithTestArgs(false);
      await expectNextPing(1);

      await suspendServiceWorker(this);
      await startWithTestArgs(false);
      await delayThenExpectNextPing(ERROR_BACKOFF_MS, 2);
    });

    it("handles HTTP 304 server response", async function() {
      const etagInitial = "initial";
      const etagUpdated = "updated";

      // Initial request
      await setConfig(oneVariantConfig("initial"), 200, etagInitial);
      await EWE.experiments.sync();

      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("initial");

      let initialiSyncStatus = await EWE.experiments.getSyncStatus();
      expect(initialiSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      // Request with matching ETag
      await setConfig("", 304, etagInitial);

      // We want to check that our lastDownload timestamp is indeed updated when
      // we get a cached response, but the headers we use only have second
      // precision, so we need to wait a moment to make sure it's actually
      // expected to change.
      await new Promise(r => setTimeout(r, 1000));
      await EWE.experiments.sync();
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("initial");

      let afterCacheSyncStatus = await EWE.experiments.getSyncStatus();
      expect(afterCacheSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
      expect(afterCacheSyncStatus.lastDownloaded)
        .not.toBe(initialiSyncStatus.lastDownloaded);

      // Request with different ETag
      await setConfig(oneVariantConfig("updated"), 200, etagUpdated);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("updated");

      // Request with new matching ETag
      await setConfig("", 304, etagUpdated);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("updated");

      const logs = await getRequestLogs(EXPERIMENT_URL);
      expect(logs.length).toBe(4);
      expect(logs[1].headers["if-none-match"]).toBe("initial");
      expect(logs[2].headers["if-none-match"]).toBe("initial");
      expect(logs[3].headers["if-none-match"]).toBe("updated");
    });

    it("sync fails with error if no experiment data URL is given", async function() {
      await EWE.experiments.sync();
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await EWE.testing.restartExperiments(
        void 0,
        PING_INTERVAL_MS,
        ERROR_BACKOFF_MS
      );
      await EWE.experiments.sync();
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        lastNetworkError: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
    });
  });

  describe("Experiment Data Validation", function() {
    const INVALID = JSON.stringify({
      schemaId: SCHEMA_ID,
      experiments: "yo"
    });
    const EXPECTED_ERRORS = ["`experiments` is not an array"];

    it("keeps the old config experiments active when there is a schema error", async function() {
      await setConfig(oneVariantConfig("test"));
      await EWE.experiments.sync();

      await setConfig(INVALID);
      await EWE.experiments.sync();

      expect(await EWE.experiments.getAssignments()).toEqual({
        [EXPERIMENT_ID]: "variant1"
      });
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("test");
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: EXPECTED_ERRORS
      });
    });

    it("returns to a no-error state after problems in the config have been fixed", async function() {
      await setConfig(INVALID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: EXPECTED_ERRORS
      });

      await setConfig(oneVariantConfig("resolved"));
      await EWE.experiments.sync();

      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("resolved");
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
    });
  });

  describe("Experiments events", function() {
    beforeEach(async function() {
      await EWE.testing.resetExperimentData();
      await clearTestEvents("experiments.updated");
    });

    it("fires an onChanged event when a new config is downloaded", async function() {
      await expectTestEvents("experiments.updated", []);
      expect(await EWE.experiments.getExperiments()).toEqual([]);

      await setConfig(oneVariantConfig("test"));
      await EWE.experiments.sync();

      await expectTestEvents("experiments.updated", [[
        [
          {
            id: EXPERIMENT_ID,
            variants: [
              {
                assigned: true,
                id: "variant1"
              }
            ]
          }
        ]
      ]]);
    });

    it("fires an onChanged event when a flag is overridden", async function() {
      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      await expectTestEvents("experiments.updated", [[[]]]);

      await EWE.experiments.clearFlagOverrides();
      await expectTestEvents("experiments.updated", [[[]], [[]]]);
    });

    it("does not fire an onChanged event for flag override functions when there is no change", async function() {
      await expectTestEvents("experiments.updated", []);

      await EWE.experiments.clearFlagOverrides();
      await expectTestEvents("experiments.updated", []);

      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      await expectTestEvents("experiments.updated", [[[]]]);

      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      await expectTestEvents("experiments.updated", [[[]]]);
    });
  });

  describe("Experiments UI API tests", function() {
    let uiPort;
    let uiTab;

    afterEach(async function() {
      await EWE.testing.resetExperimentData();
    });

    before(async function() {
      function handleConnect(port) {
        if (port.name !== "experiments-ui-test") {
          return;
        }
        uiPort = port;

        browser.runtime.onConnect.removeListener(handleConnect);
      }

      browser.runtime.onConnect.addListener(handleConnect);
      uiTab = await browser.tabs.create({url: "experiments-test.html"});
    });

    after(async function() {
      await browser.tabs.remove(uiTab.id);
    });

    async function uiSendMessage(method, ...args) {
      // Currently we check if an element is displayed on the page by
      // injecting a script into the page via browser.tab.executeScript.
      // For extension pages we cannot use this, so we pass the information
      // retrieved on the UI page via a message.
      return new Promise((resolve, reject) => {
        uiPort.postMessage({method, args});
        uiPort.onMessage.addListener(message => {
          resolve(message);
        });

        uiPort.onDisconnect.addListener(() => {
          reject(new Error("Port disconnected without receiving the flag value"));
        });
      });
    }

    async function getFlagFromUI(flagId) {
      return uiSendMessage("getFlag", flagId);
    }

    const getFlagsFromUI = (method, args) => {
      return uiSendMessage("getFlags");
    };

    it("should display UI experiment when flag is set", async function() {
      // wait for the page to load before trying to open the port
      await new Promise(r => setTimeout(r, 1000));
      await setConfig(oneVariantConfig("test-ui-flag"));
      await EWE.experiments.sync();
      const flagValue = await getFlagFromUI(EXPERIMENT_FLAG);
      expect(flagValue).toBe("test-ui-flag");
    });

    it("should NOT display UI experiment when flag is NOT set", async function() {
      const flagValue = await getFlagFromUI(EXPERIMENT_FLAG);
      expect(flagValue).toBeNull();
    });

    it("should get all experiment flags available for the user, in UI", async function() {
      await setConfig(twoVariantConfig([0, 500], [500, 1000]));
      await EWE.experiments.sync();
      const availableFlags = await EWE.experiments.getFlags();

      const uiFlags = await getFlagsFromUI();
      expect(uiFlags).toEqual(availableFlags);
    });
  });

  describe("Experiments Content Script API tests", function() {
    const timeout = 4000;

    afterEach(async function() {
      await EWE.testing.resetExperimentData();
    });

    it("should display experiment when flag is set", async function() {
      const elemId = "experiments-content-api-test";
      await setConfig(oneVariantConfig("test-content-script-flag"));
      await EWE.experiments.sync();
      const tabId = await new Page("experiments-content-api.html").loaded;
      let elem;

      await wait(async() => {
        elem = await getExistingElement(tabId, elemId);
        return elem !== null;
      }, timeout, "Experiment element is not visible");

      expect(elem).toContain(elemId);
    });

    it("should NOT display experiment when flag is NOT set", async function() {
      let elem;
      const elemId = "experiments-content-api-test";
      const tabId = await new Page("experiments-content-api.html").loaded;

      await wait(async() => {
        elem = await getExistingElement(tabId, elemId);
        return elem === null;
      }, timeout, "Experiment element is visible");

      expect(elem).toBeNull();
    });

    it("should get all available flags in content scripts", async function() {
      let elem;

      await setConfig(twoVariantConfig([0, 500], [500, 1000]));
      await EWE.experiments.sync();
      const availableFlags = await EWE.experiments.getFlags();

      const tabId = await new Page("experiments-content-api.html").loaded;

      for (let key in availableFlags) {
        await wait(async() => {
          elem = await getExistingElement(tabId, key);
          return elem !== null;
        }, timeout, `Flag ${key} not available in content script`);

        expect(elem).toContain(key);
      }
    });
  });
});
