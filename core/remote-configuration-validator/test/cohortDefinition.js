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
import { validateRemoteConfig } from "../src/validator.js";

const SCHEMA_ID = "1";

let complexExperiment = [
  {
    experimentId: "experiment-1",
    name: "An experiment",
    enabled: false,
    variants: [
      {
        variantId: "exp1-small",
        flags: { exp1_flag: "small" },
        mods: [0, 200],
      },
      {
        variantId: "exp1-medium",
        flags: { exp1_flag: "medium" },
        mods: [200, 600],
      },
      {
        variantId: "exp1-large",
        flags: { exp1_flag: "large" },
        mods: [600, 1000],
      },
    ],
  },
  {
    experimentId: "experiment-2",
    variants: [
      {
        variantId: "exp2-control",
        name: "The single variant",
        flags: { exp2_flag: "control" },
        mods: [0, 100],
      },
    ],
  },
];

let complexCohorts = [
  {
    name: "MAU Top 20 countries, free users, with install date older than 9 days and not an admin install type",
    conditions: {
      all: [
        {
          fact: "countryCode",
          operator: "in",
          value: ["US", "DE", "RO"],
        },
        {
          fact: "installDate",
          operator: "olderThan",
          value: 777600000,
        },
        {
          fact: "hasPremium",
          operator: "equal",
          value: false,
        },
        {
          not: {
            fact: "installType",
            operator: "equal",
            value: "admin",
          },
        },
      ],
    },
    event: {
      type: "top20_free_9d",
    },
  },
  {
    name: "Tier 1 country users",
    conditions: {
      all: [
        {
          fact: "countryCode",
          operator: "in",
          value: ["US", "FR", "DE", "CA", "IE", "NO"],
        },
      ],
    },
    event: {
      type: "tier1",
    },
  },
  {
    // This example demonstates nested boolean logic
    // define a rule for detecting if the user has
    // high block count since last seeing a OPD.
    // (has a block count of 100 AND has seen an OPD in 5 days)
    // OR
    // (has a block count of 200 AND has seen an OPD in 6 days)
    name: "overlay complex cohort for validation purposes",
    conditions: {
      any: [
        {
          all: [
            {
              fact: "lastSawOPDCampaign",
              operator: "greaterThan",
              value: 432000000, // 5 days in milliseconds
            },
            {
              fact: "totalBlockCount",
              operator: "greaterThanInclusive",
              value: 100,
            },
          ],
        },
        {
          all: [
            {
              fact: "lastSawOPDCampaign",
              operator: "greaterThan",
              value: 518400000, // 6 days in milliseconds
            },
            {
              not: {
                fact: "totalBlockCount",
                operator: "greaterThanInclusive",
                value: 200,
              },
            },
          ],
        },
      ],
    },
    event: {
      type: "highBlockCountAndHasnotSeenOPD",
    },
  },
];

let complexExperimentData = {
  schemaId: SCHEMA_ID,
  experiments: complexExperiment,
};

let complexExperimentAndCohortData = {
  schemaId: SCHEMA_ID,
  experiments: complexExperiment,
  cohorts: complexCohorts,
};

describe("Cohort Data Validation", function () {
  async function expectErrors(data, expectedErrors) {
    expect(validateRemoteConfig(data)).toEqual(expectedErrors);
  }

  it("marks a more complex config as valid", async function () {
    expect(validateRemoteConfig(complexExperimentData)).toEqual([]);
  });

  it("marks a simple config with cohorts as valid", async function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      cohorts: [],
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("marks a more complex config with cohorts as valid", async function () {
    expect(validateRemoteConfig(complexExperimentAndCohortData)).toEqual([]);
  });

  it("reports missing cohorts array", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [],
        cohorts: "yo",
      },
      ["instance.cohorts is not of a type(s) array"],
    );
  });

  it("validates a condition reference", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "unique test name",
            conditions: {
              all: [{ condition: "conditionName" }],
            },
            event: {
              type: "top20_free_9d",
            },
          },
        ],
      },
      [],
    );
  });

  it("validates a param reference", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "unique test name",
            conditions: {
              all: [
                {
                  fact: "blockedCount",
                  params: {
                    countryId: "widget",
                  },
                  operator: "greaterThan",
                  value: 100,
                },
              ],
            },
            event: {
              type: "someevent",
            },
          },
        ],
      },
      [],
    );
  });

  it("validates a path reference", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "unique test name",
            conditions: {
              all: [
                {
                  fact: "blockedCount",
                  path: "$.price",
                  params: {
                    productId: "widget",
                  },
                  operator: "greaterThan",
                  value: 100,
                },
              ],
            },
            event: {
              type: "someevent",
            },
          },
        ],
      },
      [],
    );
  });

  it("validates a fact to fact comparison", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "unique test name",
            conditions: {
              all: [
                {
                  fact: "installDate",
                  operator: "equal",
                  value: {
                    fact: "browserLanguage",
                  },
                },
              ],
            },
            event: {
              type: "someevent",
            },
          },
        ],
      },
      [],
    );
  });

  it("reports missing condition", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "unique test name",
            conditions: {},
            event: {
              type: "top20_free_9d",
            },
          },
        ],
      },
      ["Invalid rule 'cohort[0]'"],
    );
  });

  it("reports a bad fact", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "MAU Top 20 countries, free users, with install date older than 9 days and not an admin install type",
            conditions: {
              all: [
                {
                  fact: "countyCode",
                  operator: "multiple",
                  value: ["US"],
                },
              ],
            },
            event: {
              type: "top20_free_9d",
            },
          },
        ],
      },
      ["`countyCode` not a known fact"],
    );
  });

  it("reports a bad operator for fact", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: complexExperiment,
        cohorts: [
          {
            name: "MAU Top 20 countries, free users, with install date older than 9 days and not an admin install type",
            conditions: {
              all: [
                {
                  fact: "countryCode",
                  operator: "multiple",
                  value: ["US", "DE", "RO"],
                },
              ],
            },
            event: {
              type: "top20_free_9d",
            },
          },
        ],
      },
      ["`invalid operator multiple for fact: countryCode`"],
    );
  });
});
