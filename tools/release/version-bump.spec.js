/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from "vitest";
import {
  bumpTypeForTitles,
  bumpVersion,
  updateVersionInConfigContent,
} from "./version-bump.js";

describe("updateVersionInConfigContent", () => {
  it("updates the version number and preserves the rest of the file", () => {
    const configFile = `export default {
        basename: "adblock",
        version: "6.10.0",
        webpack: {
          // some other config
        }
      }`;

    const result = updateVersionInConfigContent(configFile, "7.0.0");
    expect(result).toEqual(configFile.replace("6.10.0", "7.0.0"));
  });

  it("updates the version number if the file is minified", () => {
    const configFile = `export default{webpack:{},version:"8.1"}`;

    const result = updateVersionInConfigContent(configFile, "7.0.0");
    expect(result).toEqual(configFile.replace("8.1", "7.0.0"));
  });

  it("throws error if version field not found", () => {
    const configWithoutVersion = `export default {
      basename: "adblock",
      someOtherField: "6.10.0"
    }`;

    expect(() => {
      updateVersionInConfigContent(configWithoutVersion, "7.0.0");
    }).toThrow("Could not find version field in the config file");
  });
});

describe("bumpTypeForTitles", () => {
  it("is patch when there are no commits", () => {
    expect(bumpTypeForTitles([])).toBe("patch");
  });

  it("is patch for rules updates, fixes and other non-feature changes", () => {
    expect(
      bumpTypeForTitles([
        "build: Updated filterlists dependency to update rules data",
        "fix: Serialize tab-session cleanup [OM-1641]",
      ]),
    ).toBe("patch");
  });

  it("is minor when at least one commit is a feature", () => {
    expect(bumpTypeForTitles(["fix: A [OM-1]", "feat: B [OM-2]"])).toBe(
      "minor",
    );
    expect(bumpTypeForTitles(["feat(adblock): B [OM-2]"])).toBe("minor");
    expect(bumpTypeForTitles(["feat!: B [OM-2]"])).toBe("minor");
  });
});

describe("bumpVersion", () => {
  it("bumps minor and patch", () => {
    expect(bumpVersion("6.46.1", "minor")).toBe("6.47.0");
    expect(bumpVersion("6.46.1", "patch")).toBe("6.46.2");
  });

  it("drops a legacy fourth segment", () => {
    expect(bumpVersion("6.44.0.1", "patch")).toBe("6.44.1");
    expect(bumpVersion("6.44.0.1", "minor")).toBe("6.45.0");
  });

  it("throws on a version it cannot parse", () => {
    expect(() => bumpVersion("6.44", "patch")).toThrow();
    expect(() => bumpVersion("nope", "patch")).toThrow();
  });
});
