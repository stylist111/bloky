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

describe("Experiment Data Validation", function () {
  async function expectErrors(data, expectedErrors) {
    expect(validateRemoteConfig(data)).toEqual(expectedErrors);
  }

  it("marks a more complex config as valid", async function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [
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
      ],
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("reports missing experiments array", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: "yo",
      },
      ["instance.experiments is not of a type(s) array"],
    );
  });

  it("reports duplicate experiment IDs", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [],
          },
          {
            experimentId: "test1",
            variants: [],
          },
        ],
      },
      [
        "`experiments[1].experimentId` test1 appears as the experiment ID on a previous experiment",
      ],
    );
  });

  it("reports when experimentId is not a string", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: 123,
            variants: [],
          },
        ],
      },
      ["instance.experiments[0].experimentId is not of a type(s) string"],
    );
  });

  it("reports when optional experiment fields are wrong type", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            name: 123,
            description: true,
            enabled: "true",
            variants: [],
          },
        ],
      },
      [
        "instance.experiments[0].name is not of a type(s) string",
        "instance.experiments[0].enabled is not of a type(s) boolean",
      ],
    );
  });

  it("reports when variants is not an array", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: "not an array",
          },
        ],
      },
      ["instance.experiments[0].variants is not of a type(s) array"],
    );
  });

  it("reports duplicate variant IDs within an experiment", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                flags: {},
                mods: [0, 1],
              },
              {
                variantId: "variant1",
                flags: {},
                mods: [1, 2],
              },
            ],
          },
        ],
      },
      [
        "`experiments[0].variants[1].variantId` variant1 appears as the variantId on a previous variant in this experiment",
      ],
    );
  });

  it("reports when variantId is not a string", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: 123,
                flags: {},
                mods: [0, 1],
              },
            ],
          },
        ],
      },
      [
        "instance.experiments[0].variants[0].variantId is not of a type(s) string",
      ],
    );
  });

  it("reports when optional variant name and flags are wrong types", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                name: 123,
                flags: "not an object",
                mods: [0, 1],
              },
            ],
          },
        ],
      },
      [
        "instance.experiments[0].variants[0].flags is not of a type(s) object",
        "instance.experiments[0].variants[0].name is not of a type(s) string",
      ],
    );
  });

  it("reports when flags are missing", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                name: "123",
                mods: [0, 1],
              },
            ],
          },
        ],
      },
      ['instance.experiments[0].variants[0] requires property "flags"'],
    );
  });

  it("reports when mods is not an array or wrong length", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                flags: {},
                mods: "not an array",
              },
              {
                variantId: "variant2",
                flags: {},
                mods: [0],
              },
            ],
          },
        ],
      },
      ["instance.experiments[0].variants[0].mods is not of a type(s) array"],
    );
  });

  it("reports when mod values are not numbers between 0 and 1000", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                flags: {},
                mods: ["0", 1],
              },
              {
                variantId: "variant2",
                flags: {},
                mods: [-1, 500],
              },
              {
                variantId: "variant3",
                flags: {},
                mods: [0, 1001],
              },
            ],
          },
        ],
      },
      [
        "instance.experiments[0].variants[0].mods[0] is not of a type(s) integer",
        "instance.experiments[0].variants[1].mods[0] must be greater than or equal to 0",
        "instance.experiments[0].variants[2].mods[1] must be less than or equal to 1000",
      ],
    );
  });

  it("reports when first mod value is not smaller than second", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                flags: {},
                mods: [500, 500],
              },
              {
                variantId: "variant2",
                flags: {},
                mods: [600, 500],
              },
            ],
          },
        ],
      },
      [
        "`experiments[0].variants[0].mods[0]` is not smaller than `experiments[0].variants[0].mods[1]`",
        "`experiments[0].variants[1].mods[0]` is not smaller than `experiments[0].variants[1].mods[1]`",
      ],
    );
  });

  it("reports duplicate flag names across different experiments", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "variant1",
                flags: {
                  shared_flag: "value1",
                  unique_flag1: "value2",
                },
                mods: [0, 500],
              },
            ],
          },
          {
            experimentId: "test2",
            variants: [
              {
                variantId: "variant1",
                flags: {
                  shared_flag: "value3",
                  unique_flag2: "value4",
                },
                mods: [500, 1000],
              },
            ],
          },
          {
            experimentId: "test3",
            variants: [
              {
                variantId: "variant1",
                flags: {
                  shared_flag: "value4",
                  unique_flag3: "value4",
                },
                mods: [500, 1000],
              },
            ],
          },
        ],
      },
      [
        "`experiments[1].variants[0].flag[shared_flag] appears in multiple experiments",
        "`experiments[2].variants[0].flag[shared_flag] appears in multiple experiments",
      ],
    );
  });

  it("reports when mod ranges overlap within an experiment", async function () {
    await expectErrors(
      {
        schemaId: SCHEMA_ID,
        experiments: [
          {
            experimentId: "test1",
            variants: [
              {
                variantId: "control-variant",
                flags: {},
                mods: [100, 500],
              },
              {
                variantId: "overlap-high",
                flags: {},
                mods: [400, 1000],
              },
              {
                variantId: "overlap-center",
                flags: {},
                mods: [150, 200],
              },
              {
                variantId: "overlap-low",
                flags: {},
                mods: [0, 130],
              },
            ],
          },
        ],
      },
      [
        "Mod ranges [100-500] and [400-1000] overlap in experiment 'test1'",
        "Mod ranges [100-500] and [150-200] overlap in experiment 'test1'",
        "Mod ranges [100-500] and [0-130] overlap in experiment 'test1'",
      ],
    );
  });
});
