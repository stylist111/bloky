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

import {clearTestEvents, EWE, expectTestEvents} from "./messaging.js";

const countryCode = "US";
const defaultFacts = {
  hasPremium: false,
  installDate: new Date("2023-01-01T00:00:00Z").getTime()
};

const cohort1Config = {
  name: "MAU Top 20 countries, free users, with install date older than 9 days",
  conditions: {
    all: [
      {
        fact: "countryCode",
        operator: "in",
        value: ["US", "DE", "RO"]
      },
      {
        fact: "installDate",
        operator: "olderThan",
        value: 777600000
      },
      {
        fact: "hasPremium",
        operator: "equal",
        value: false
      }
    ]
  },
  event: {
    type: "top20_free_9d"
  }
};

const cohort2Config = {
  name: "Tier 1 country users",
  conditions: {
    all: [
      {
        fact: "countryCode",
        operator: "in",
        value: [
          "US", "FR", "CA", "GB", "MX", "ES", "DE", "IT", "AU", "TW",
          "JP", "NL", "BE", "SE", "IL", "DK", "CH", "AT", "IE", "NO"
        ]
      }
    ]
  },
  event: {
    type: "tier1"
  }
};

const config = [
  cohort1Config,
  cohort2Config
];

describe("Cohorts", function() {
  beforeEach(async function() {
    await EWE.testing.mockFacts(defaultFacts);
    await EWE.testing.resetCohortsData();
  });

  it("returns an empty state before first sync", async function() {
    await EWE.testing.resetRemoteConfig();
    await EWE.testing.resetCohortsData();

    expect(await EWE.remoteConfig.getConfig()).toBeUndefined();
    expect(await EWE.remoteConfig.getCohortsConfig()).toEqual([]);
  });

  it("initially returns an empty array for get all cohorts", async function() {
    await EWE.testing.resetRemoteConfig();
    await EWE.testing.resetCohortsData();

    expect(await EWE.cohorts.getAll()).toEqual([]);
  });

  it("returns the cohorts assigned", async function() {
    await EWE.cohorts.sync(config, countryCode);

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toHaveLength(2);
    expect(cohorts).toEqual(expect.arrayContaining([
      cohort1Config.event.type,
      cohort2Config.event.type
    ]));
  });

  it("updates cohorts when facts change", async function() {
    await EWE.cohorts.sync(config, countryCode);

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
    await EWE.cohorts.sync(config, countryCode);

    const updatedCohorts = await EWE.cohorts.getAll();
    expect(updatedCohorts).toEqual([
      cohort2Config.event.type
    ]);
  });

  it("assigns the right cohorts based on facts", async function() {
    await EWE.cohorts.sync(config, "FR");

    const cohorts = await EWE.cohorts.getAll();
    expect(cohorts).toEqual([cohort2Config.event.type]);
  });

  it("clears old cohorts when new config is empty", async function() {
    await EWE.cohorts.sync(config, countryCode);
    expect(await EWE.cohorts.getAll()).toHaveLength(2);

    await EWE.cohorts.sync([], countryCode);
    expect(await EWE.cohorts.getAll()).toEqual([]);
  });

  describe("Missing facts or operators", function() {
    it("does not throw error when fact is missing and ignores the config", async function() {
      await EWE.cohorts.sync([
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
      ], countryCode);

      const cohorts = await EWE.cohorts.getAll();
      expect(cohorts).toEqual([cohort2Config.event.type]);
    });

    it("does not throw error when operator is missing and ignores the config", async function() {
      await EWE.cohorts.sync([
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
      ], countryCode);

      const cohorts = await EWE.cohorts.getAll();
      expect(cohorts).toEqual([cohort2Config.event.type]);
    });
  });

  it("returns false for includes if not in cohort", async function() {
    await EWE.cohorts.sync(config, countryCode);
    expect(await EWE.cohorts.includes("non_existent_cohort")).toBe(false);
  });

  describe("Cohorts events", function() {
    beforeEach(async function() {
      await clearTestEvents("cohorts.updated");
    });

    it("fires an onChanged event when cohorts are updated", async function() {
      await expectTestEvents("cohorts.updated", []);
      expect(await EWE.cohorts.getAll()).toEqual([]);

      // Sync with country code set to FR to trigger ONLY cohort2
      await EWE.cohorts.sync(config, "FR");
      await expectTestEvents("cohorts.updated", [[[cohort2Config.event.type]]]);
    });
  });
});
