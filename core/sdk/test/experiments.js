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
import {
  EXPERIMENT_FLAG,
  EXPERIMENT_ID,
  LOWER_HALF_USER_ID,
  LOWER_VARIANT_FLAG,
  LOWER_VARIANT_ID,
  oneVariantConfig,
  twoVariantConfig,
  UPPER_HALF_USER_ID,
  UPPER_VARIANT_FLAG,
  UPPER_VARIANT_ID
} from "./fixtures/experiments.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {DEFAULT_CONFIG, setConfig} from "./fixtures/remote-config.js";

describe("Split Experiments", function() {
  beforeEach(async function() {
    await EWE.testing.resetRemoteConfig();
    await EWE.testing.resetExperimentData();
  });

  it("returns an empty state before first sync", async function() {
    expect(await EWE.experiments.getAssignments()).toEqual({});
    expect(await EWE.experiments.getExperiments()).toEqual([]);
  });

  it("initially returns an empty object for get all flags", async function() {
    const flags = await EWE.experiments.getFlags();
    expect(flags).toEqual({});
  });

  describe("Variant assignment", function() {
    it("initially returns null for a flag", async function() {
      const flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
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
      const config = oneVariantConfig("test");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
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

    it("loads experiments state after SW restart [mv3-only]", async function() {
      await setConfig(DEFAULT_CONFIG);
      await EWE.remoteConfig.sync();

      const expectedExperiments = [
        {
          id: DEFAULT_CONFIG.experiments[0].experimentId,
          variants: [
            {
              assigned: true,
              id: "variant1"
            }
          ]
        }
      ];
      expect(await EWE.experiments.getExperiments())
        .toEqual(expectedExperiments);

      await suspendServiceWorker(this);

      // expect that after SW restart the experiments state
      // is equal to the one before
      expect(await EWE.experiments.getExperiments())
        .toEqual(expectedExperiments);
    });

    it("returns one flag with value", async function() {
      const config = oneVariantConfig("test");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();

      const flags = await EWE.experiments.getFlags();
      expect(flags).toEqual({
        [EXPERIMENT_FLAG]: "test"
      });
    });

    it("gets the value of the flag in the experiment the user is assigned to", async function() {
      const config = oneVariantConfig("simple");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();

      const flag = await EWE.experiments.getFlag(EXPERIMENT_FLAG);
      expect(flag).toBe("simple");
    });

    it("gets the value of a flag regardless of its type", async function() {
      const config = [{
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
      }];

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();

      expect(await EWE.experiments.getFlag("string_flag")).toBe("value1");
      expect(await EWE.experiments.getFlag("number_flag")).toBe(42);
      expect(await EWE.experiments.getFlag("array_flag")).toEqual(["item1", "item2"]);
      expect(await EWE.experiments.getFlag("boolean_flag")).toBe(true);
      expect(await EWE.experiments.getFlag("object_flag")).toEqual({key: "value"});
    });

    it("gets all values for all flags regardless of its type", async function() {
      const config = [{
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
      }];

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const flags = await EWE.experiments.getFlags();
      expect(flags).toEqual({
        string_flag: "value1",
        number_flag: 42,
        array_flag: ["item1", "item2"],
        boolean_flag: true,
        object_flag: {key: "value"}
      });
    });

    it("deterministically assigns users to variants based on their seed", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
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
      const config = twoVariantConfig([0, 215], [215, 1000]);

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({
        [EXPERIMENT_ID]: UPPER_VARIANT_ID
      });
    });

    it("doesn't assign to a variant if there isn't a relevant one", async function() {
      const config = twoVariantConfig([0, 215], [216, 1000]);

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      expect(await EWE.experiments.getAssignments()).toEqual({});
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe(null);
    });

    it("deterministically assigns users to various variants based on their seeds", async function() {
      const config = [{
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
      }];

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

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });

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
      const config = [
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
      ];

      // LOWER_HALF_USER_ID hashes to 215 with experiment-1
      // LOWER_HALF_USER_ID hashes to 775 with experiment-2
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
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
      const config = [
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
      ];

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });

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

      let config = twoVariantConfig([0, 500], [500, 1000]);

      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);

      await EWE.testing.setExperimentsSeed(UPPER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(UPPER_VARIANT_ID, UPPER_VARIANT_FLAG);

      config = twoVariantConfig([0, 950], [950, 1000]);
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });

      await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);

      await EWE.testing.setExperimentsSeed(UPPER_HALF_USER_ID);
      await EWE.experiments.sync();
      await userShouldBeInVariant(LOWER_VARIANT_ID, LOWER_VARIANT_FLAG);
    });

    describe("Conditional experiments", function() {
      const defaultMockFacts = {
        hasPremium: false,
        installDate: new Date("2023-01-01T00:00:00Z").getTime(),
        blockedCount: 0,
        isTrial: false,
        trialDaysLeft: null,
        marketingConsent: false
      };

      const premiumConditions = {
        all: [
          {
            fact: "hasPremium",
            operator: "equal",
            value: true
          }
        ]
      };

      function conditionalExperimentConfig(conditions, flagValue) {
        return [{
          experimentId: EXPERIMENT_ID,
          conditions,
          variants: [{
            variantId: "variant1",
            flags: {[EXPERIMENT_FLAG]: flagValue},
            mods: [0, 1000]
          }]
        }];
      }

      it("skips experiment when conditions don't match", async function() {
        const config = conditionalExperimentConfig(
          premiumConditions, "premium-feature"
        );
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });

        await EWE.testing.mockFacts({...defaultMockFacts, hasPremium: false});
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBeNull();
        expect(await EWE.experiments.getAssignments()).toEqual({});
      });

      it("assigns user when conditions match", async function() {
        const config = conditionalExperimentConfig(
          premiumConditions, "premium-feature"
        );
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });

        await EWE.testing.mockFacts({...defaultMockFacts, hasPremium: true});
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
          .toBe("premium-feature");
        expect(await EWE.experiments.getAssignments()).toEqual({
          [EXPERIMENT_ID]: "variant1"
        });
      });

      it("reassigns experiment and fires onChanged when facts change", async function() {
        await clearTestEvents("experiments.updated");

        const config = conditionalExperimentConfig(
          premiumConditions, "premium-feature"
        );
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });

        // Non-premium user — not assigned
        await EWE.testing.mockFacts({...defaultMockFacts, hasPremium: false});
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBeNull();
        expect(await EWE.experiments.getAssignments()).toEqual({});

        await clearTestEvents("experiments.updated");

        // Facts change: user becomes premium — should be assigned
        await EWE.testing.mockFacts({...defaultMockFacts, hasPremium: true});
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
          .toBe("premium-feature");
        expect(await EWE.experiments.getAssignments()).toEqual({
          [EXPERIMENT_ID]: "variant1"
        });

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

      it("evaluates time-based conditions like withinLast", async function() {
        const newUserConditions = {
          all: [{
            fact: "installDate",
            operator: "withinLast",
            value: 14 * 24 * 60 * 60 * 1000 // 14 days
          }]
        };
        const config = conditionalExperimentConfig(
          newUserConditions, "new-user-feature"
        );
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });

        // New user (7 days ago) — assigned
        await EWE.testing.mockFacts({
          ...defaultMockFacts,
          installDate: Date.now() - (7 * 24 * 60 * 60 * 1000)
        });
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG))
          .toBe("new-user-feature");

        // Old user (30 days ago) — not assigned
        await EWE.testing.mockFacts({
          ...defaultMockFacts,
          installDate: Date.now() - (30 * 24 * 60 * 60 * 1000)
        });
        await EWE.experiments.sync();
        expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBeNull();
      });

      it("skips experiment with an unknown fact", async function() {
        await EWE.testing.mockFacts(defaultMockFacts);

        const config = [
          {
            experimentId: "unknown-fact-exp",
            conditions: {
              all: [
                {
                  fact: "nonExistentFact",
                  operator: "equal",
                  value: true
                }
              ]
            },
            variants: [{
              variantId: "variant1",
              flags: {unknown_fact_flag: "should-not-appear"},
              mods: [0, 1000]
            }]
          },
          {
            experimentId: "unconditional-exp",
            variants: [{
              variantId: "uncond-variant",
              flags: {uncond_flag: "always"},
              mods: [0, 1000]
            }]
          }
        ];

        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });
        await EWE.experiments.sync();

        // Experiment with unknown fact should be skipped
        expect(await EWE.experiments.getFlag("unknown_fact_flag")).toBeNull();
        // Unconditional experiment should still be assigned
        expect(await EWE.experiments.getFlag("uncond_flag")).toBe("always");
        expect(await EWE.experiments.getAssignments()).toEqual({
          "unconditional-exp": "uncond-variant"
        });
      });

      it("skips experiment with an unknown operator", async function() {
        await EWE.testing.mockFacts(defaultMockFacts);

        const config = [
          {
            experimentId: "unknown-op-exp",
            conditions: {
              all: [
                {
                  fact: "hasPremium",
                  operator: "nonExistentOperator",
                  value: true
                }
              ]
            },
            variants: [{
              variantId: "variant1",
              flags: {unknown_op_flag: "should-not-appear"},
              mods: [0, 1000]
            }]
          },
          {
            experimentId: "unconditional-exp",
            variants: [{
              variantId: "uncond-variant",
              flags: {uncond_flag: "always"},
              mods: [0, 1000]
            }]
          }
        ];

        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });
        await EWE.experiments.sync();

        // Experiment with unknown operator should be skipped
        expect(await EWE.experiments.getFlag("unknown_op_flag")).toBeNull();
        // Unconditional experiment should still be assigned
        expect(await EWE.experiments.getFlag("uncond_flag")).toBe("always");
        expect(await EWE.experiments.getAssignments()).toEqual({
          "unconditional-exp": "uncond-variant"
        });
      });

      it("handles mix of conditional and unconditional experiments", async function() {
        await EWE.testing.mockFacts(defaultMockFacts);

        const config = [
          {
            experimentId: "conditional-exp",
            conditions: premiumConditions,
            variants: [{
              variantId: "cond-variant",
              flags: {cond_flag: "conditional"},
              mods: [0, 1000]
            }]
          },
          {
            experimentId: "unconditional-exp",
            variants: [{
              variantId: "uncond-variant",
              flags: {uncond_flag: "unconditional"},
              mods: [0, 1000]
            }]
          }
        ];

        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: config
        });
        await EWE.experiments.sync();

        // Conditional experiment should NOT be assigned (not premium)
        expect(await EWE.experiments.getFlag("cond_flag")).toBeNull();
        // Unconditional experiment should be assigned
        expect(await EWE.experiments.getFlag("uncond_flag"))
          .toBe("unconditional");
        expect(await EWE.experiments.getAssignments()).toEqual({
          "unconditional-exp": "uncond-variant"
        });
      });
    });

    describe("Experiments encoding", function() {
      function getExperimentsConfig(assignedVariants) {
        const config = [
          {
            experimentId: "1",
            variants: [
              {variantId: "1"},
              {variantId: "2"}
            ]
          },
          {
            experimentId: "11",
            variants: [
              {variantId: "3"},
              {variantId: "4"}
            ]
          },
          {
            experimentId: "a1",
            variants: [
              {variantId: "5"},
              {variantId: "6"},
              {variantId: "7"},
              {variantId: "8"}
            ]
          },
          {
            experimentId: "a2",
            variants: [{variantId: "9"}]
          },
          {
            experimentId: "11111",
            variants: [{variantId: "10"}]
          }
        ];

        config.forEach(experiment => {
          const assigned = experiment.variants.filter(
            v => assignedVariants.includes(v.variantId)
          );
          const unassigned = experiment.variants.filter(
            v => !assignedVariants.includes(v.variantId)
          );

          const assignedSize =
            assigned.length > 0 ? Math.floor(500 / assigned.length) : 0;
          assigned.forEach((variant, index) => {
            variant.mods = [index * assignedSize, (index + 1) * assignedSize];
          });

          const unassignedSize =
            unassigned.length > 0 ? Math.floor(500 / unassigned.length) : 0;
          unassigned.forEach((variant, index) => {
            variant.mods = [
              500 + index * unassignedSize,
              500 + (index + 1) * unassignedSize
            ];
          });
        });

        return config;
      }

      it("encodes empty experiments assignments as base64 string", async function() {
        await EWE.experiments.sync();
        const encoding = await EWE.experiments.getEncodedExperiments();
        expect(encoding).toEqual("AA==");
      });

      it("encodes experiments assignments as base64 string", async function() {
        let encoding;

        await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: getExperimentsConfig(["1"])
        });
        await EWE.experiments.sync();
        encoding = await EWE.experiments.getEncodedExperiments();
        expect(encoding).toEqual("AQ==");

        await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: getExperimentsConfig(["1", "3"])
        });
        await EWE.experiments.sync();
        encoding = await EWE.experiments.getEncodedExperiments();
        expect(encoding).toEqual("BQ==");

        await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: getExperimentsConfig(["10"])
        });
        await EWE.experiments.sync();
        encoding = await EWE.experiments.getEncodedExperiments();
        expect(encoding).toEqual("AgA=");

        await EWE.testing.setExperimentsSeed(LOWER_HALF_USER_ID);
        await EWE.testing.mockRemoteConfig({
          ...DEFAULT_CONFIG,
          experiments: getExperimentsConfig(["3", "5", "10"])
        });
        await EWE.experiments.sync();
        encoding = await EWE.experiments.getEncodedExperiments();
        expect(encoding).toEqual("AhQ=");
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

      const config = oneVariantConfig("test");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
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

    it("can clear a single flag override", async function() {
      await EWE.experiments.overrideFlag("flag_a", "value_a");
      await EWE.experiments.overrideFlag("flag_b", "value_b");

      await EWE.experiments.clearFlagOverride("flag_a");

      expect(await EWE.experiments.getFlag("flag_a")).toBeNull();
      expect(await EWE.experiments.getFlag("flag_b")).toBe("value_b");
    });

    it("restores remote flag value after clearing override", async function() {
      const config = oneVariantConfig("remote_value");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();

      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "local_override");
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("local_override");

      await EWE.experiments.clearFlagOverride(EXPERIMENT_FLAG);
      expect(await EWE.experiments.getFlag(EXPERIMENT_FLAG)).toBe("remote_value");
    });

    it("fires an onChanged event when a single flag override is cleared", async function() {
      await EWE.experiments.overrideFlag(EXPERIMENT_FLAG, "potato");
      await clearTestEvents("experiments.updated");

      await EWE.experiments.clearFlagOverride(EXPERIMENT_FLAG);
      await expectTestEvents("experiments.updated", [[[]]]);
    });

    it("does not fire an onChanged event when clearing a non-existent override", async function() {
      await expectTestEvents("experiments.updated", []);

      await EWE.experiments.clearFlagOverride("non_existent_flag");
      await expectTestEvents("experiments.updated", []);
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

    it("does not fire an onChanged event when sync produces the same results", async function() {
      const config = oneVariantConfig("test");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();

      await clearTestEvents("experiments.updated");

      // Sync again with same config — should not fire
      await EWE.experiments.sync();
      await expectTestEvents("experiments.updated", []);
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
      const config = oneVariantConfig("test-ui-flag");
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const flagValue = await getFlagFromUI(EXPERIMENT_FLAG);
      expect(flagValue).toBe("test-ui-flag");
    });

    it("should NOT display UI experiment when flag is NOT set", async function() {
      const flagValue = await getFlagFromUI(EXPERIMENT_FLAG);
      expect(flagValue).toBeNull();
    });

    it("should get all experiment flags available for the user, in UI", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const availableFlags = await EWE.experiments.getFlags();

      const uiFlags = await getFlagsFromUI();
      expect(uiFlags).toEqual(availableFlags);
    });
  });
});
