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

describe("General Schema Validation", function () {
  async function expectErrors(data, expectedErrors) {
    expect(validateRemoteConfig(data)).toEqual(expectedErrors);
  }

  it("marks a simple config as valid", async function () {
    let data = {
      schemaId: SCHEMA_ID,
      experiments: [],
    };
    expect(validateRemoteConfig(data)).toEqual([]);
  });

  it("reports when root data is not an object", async function () {
    await expectErrors("not an object", ["root data is not an object"]);
  });

  it("reports when the schema id has changed or is missing", async function () {
    await expectErrors({}, [
      "This system does not support a schemaId of 'undefined'",
    ]);

    await expectErrors({ schemaId: "potato" }, [
      "This system does not support a schemaId of 'potato'",
    ]);
  });
});
