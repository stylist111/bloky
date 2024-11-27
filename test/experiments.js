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

import {EWE} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {
  clearEndpointResponse,
  clearRequestLogs,
  getRequestLogs,
  setEndpointResponse,
  setMinTimeout,
  waitForAssertion
} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

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

async function startWithTestArgs() {
  await EWE.testing.restartExperiments(
    EXPERIMENT_URL, PING_INTERVAL_MS, ERROR_BACKOFF_MS
  );
}

describe("Split Experiments", function() {
  afterEach(async function() {
    await clearEndpointResponse(EXPERIMENT_URL);
    await EWE.experiments.clearFlagOverrides();
    await startWithTestArgs();
  });

  describe("Variant assignment", function() {
    it("initially returns null for a flag", async function() {
      let flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
      expect(flag).toBeNull();
    });

    it("can override and retrieve a flag value", async function() {
      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      let flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
      expect(flag).toBe("potato");
    });

    it("returns an empty state before first sync", async function() {
      await EWE.testing.resetExperimentData();
      expect(await EWE.experiments.getSyncStatus()).toEqual({
        errors: []
      });
    });

    it("returns an empty assignment before first sync", async function() {
      await EWE.testing.resetExperimentData();
      expect(await EWE.experiments.getAssignments()).toEqual({});
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
      await startWithTestArgs();

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
      await startWithTestArgs();

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
      await startWithTestArgs();
      await expectNextPing(1);

      await suspendServiceWorker(this);
      await startWithTestArgs();
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
});
