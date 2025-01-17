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
import fs from "fs";
import os from "os";
import path from "path";

import {generateFragment, isUUID}
  from "../../scripts/generateSubscriptionsFragment.js";

const VALID_RULESET_FILE = "03648752-31EE-4FD0-85C1-20B07C5551C3";
const VALID_RULESET_FILE2 = "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F";

describe("isUUID()", function() {
  it("is falsy in edge cases", function() {
    expect(isUUID()).toBeFalsy();
    expect(isUUID(null)).toBeFalsy();
    expect(isUUID("")).toBeFalsy();
    expect(isUUID(".")).toBeFalsy();
  });

  it("is falsy for non UUID strings", function() {
    expect(isUUID("something")).toBeFalsy();
  });

  it("is truthy for UUID strings", function() {
    expect(isUUID("0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F")).toBeTruthy();
    expect(isUUID("5BD2BB73-459D-4A74-AF9D-A10157268350")).toBeTruthy();
    expect(isUUID("00000000-0000-0000-0000-000000000000")).toBeTruthy();
  });

  it("supports all UUID versions", function() {
    expect(isUUID("2ef7cc5c-22c2-11ed-861d-0242ac120002")).toBeTruthy(); // v1
    expect(isUUID("2ef7cc5c-22c2-21ed-861d-0242ac120002")).toBeTruthy(); // v2
    expect(isUUID("2ef7cc5c-22c2-31ed-861d-0242ac120002")).toBeTruthy(); // v3
    expect(isUUID("1ab0186b-3bcb-43e8-a20f-07840c422c29")).toBeTruthy(); // v4
    expect(isUUID("2e1f9cee-f240-5dd7-b9d4-9b3cde9e425c")).toBeTruthy(); // v5
  });

  it("is not case-sensitive", function() {
    expect(isUUID("0798b6a2-94a4-4adf-89ed-bec112fc4c7f")).toBeTruthy();
  });

  it("is whitespace-sensitive", function() {
    let strWithWhitespaces = "07549d8b - f06f - 4d9d - a567 - 929aa59e9d1d";
    expect(isUUID(strWithWhitespaces)).toBeFalsy();
    expect(isUUID(strWithWhitespaces.replace(/\s+/g, ""))).toBeTruthy();
  });
});

describe("generateSubscriptionsFragment script", function() {
  let tmpDir;
  let originalConsoleWarn;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  beforeEach(function() {
    let dirPath = path.join(os.tmpdir(), "rules-");
    tmpDir = fs.mkdtempSync(dirPath);
    originalConsoleWarn = console.warn;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(function() {
    if (fs.existsSync(tmpDir)) {
      fs.rmdirSync(tmpDir, {recursive: true});
    }
    console.warn = originalConsoleWarn;
  });

  function createRuleFile(filename) {
    fs.openSync(path.join(tmpDir, filename), "w");
  }

  function getRulesArrayFrom(dir) {
    return JSON.parse(
      generateFragment(dir, null, null)).rule_resources;
  }

  it("throws an error if rules directory does not exist", function() {
    fs.rmdirSync(tmpDir, {recursive: true});
    expect(() => generateFragment(tmpDir)).toThrow(Error);
  });

  it("returns empty array for empty dir", function() {
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
  });

  it("warns on empty dir", function() {
    expect(warnings.length).toEqual(0);
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
    expect(warnings.length).toEqual(1);
  });

  it("ignores not subscriptions files", function() {
    createRuleFile("jsfile.js");
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
  });

  it("warns on not subscription files", function() {
    expect(warnings.length).toEqual(0);
    createRuleFile("jsfile.js");
    createRuleFile(VALID_RULESET_FILE);
    generateFragment(tmpDir, null, null);
    expect(warnings.length).toEqual(1);
  });

  it("returns single rule", function() {
    createRuleFile(VALID_RULESET_FILE);
    let fragment = generateFragment(tmpDir, null, null);
    expect(JSON.parse(fragment)["rule_resources"].length).toEqual(1);
  });

  it("returns valid rule id", function() {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    expect(getRulesArrayFrom(tmpDir)[0].id).toEqual(filename);
  });

  it("returns rules disabled by default", function() {
    createRuleFile(VALID_RULESET_FILE);
    expect(getRulesArrayFrom(tmpDir)[0].enabled).toEqual(false);
  });

  it("returns proper file path", function() {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    expect(getRulesArrayFrom(tmpDir)[0].path).toEqual(filename);
  });

  it("returns proper file path with prefix", function() {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    const prefix = "subscriptions/";
    let rules = JSON.parse(
      generateFragment(tmpDir, prefix, null)).rule_resources;
    expect(rules[0].path).toEqual(prefix + filename);
  });

  it("returns multiple rules", function() {
    createRuleFile(VALID_RULESET_FILE);
    createRuleFile(VALID_RULESET_FILE2);
    expect(getRulesArrayFrom(tmpDir).length).toEqual(2);
  });

  it("prettifies JSON if space is passed", function() {
    createRuleFile(VALID_RULESET_FILE);
    expect(generateFragment(tmpDir, null, null))
      .toEqual(`{"rule_resources":[{"id":"${VALID_RULESET_FILE}","enabled":false,"path":"${VALID_RULESET_FILE}"}]}`);
    expect(generateFragment(tmpDir, null, 2)).toEqual(
`{
  "rule_resources": [
    {
      "id": "${VALID_RULESET_FILE}",
      "enabled": false,
      "path": "${VALID_RULESET_FILE}"
    }
  ]
}`);
    expect(generateFragment(tmpDir, null, "\t")).toEqual(
`{
\t"rule_resources": [
\t\t{
\t\t\t"id": "${VALID_RULESET_FILE}",
\t\t\t"enabled": false,
\t\t\t"path": "${VALID_RULESET_FILE}"
\t\t}
\t]
}`);
  });
});
