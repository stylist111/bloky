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

describe("Logging Data Validation", function () {
  it("marks a missing logging config as valid", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("marks a valid config as valid", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        global: "warn",
        byModule: {
          module1: "behavior",
          module2: "debug",
        },
        mods: [0, 10],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("allows the global level to be optional", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        byModule: {
          module1: "behavior",
          module2: "debug",
        },
        mods: [0, 10],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("allows the byModule to be optional", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        global: "warn",
        mods: [0, 10],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("reports missing mods", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        global: "warn",
      },
    };
    expect(validateRemoteConfig(data)).toEqual([
      'instance.loggingLevels requires property "mods"',
    ]);
  });

  it("reports invalid mods", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        global: "warn",
        mods: [0.5, 9000],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([
      "instance.loggingLevels.mods[0] is not of a type(s) integer",
      "instance.loggingLevels.mods[1] must be less than or equal to 1000",
    ]);
  });

  it("reports invalid global level", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        global: "potato",
        mods: [0, 1000],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([
      "instance.loggingLevels.global is not one of enum values: debug,info,behavior,warn,off",
    ]);
  });

  it("reports invalid byModule level", function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
      loggingLevels: {
        byModule: {
          module1: 5,
          module2: "behaviour", // incorrect spelling!
        },
        mods: [0, 10],
      },
    };
    expect(validateRemoteConfig(data)).toEqual([
      "instance.loggingLevels.byModule.module1 is not of a type(s) string",
      "instance.loggingLevels.byModule.module1 is not one of enum values: debug,info,behavior,warn,off",
      "instance.loggingLevels.byModule.module2 is not one of enum values: debug,info,behavior,warn,off",
    ]);
  });
});
