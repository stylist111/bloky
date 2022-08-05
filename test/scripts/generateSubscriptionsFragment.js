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

import {generateFragment} from "../../scripts/generateSubscriptionsFragment.js";

const VALID_RULESET_FILE = "03648752-31EE-4FD0-85C1-20B07C5551C3";
const VALID_RULESET_FILE2 = "07549D8B-F06F-4D9D-A567-929AA59E9D1D";

describe("generateSubscriptionsFragment script", () => {
  let tmpDir;
  let originalConsoleWarn;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  beforeEach(() => {
    let dirPath = path.join(os.tmpdir(), "rules-");
    tmpDir = fs.mkdtempSync(dirPath);
    originalConsoleWarn = console.warn;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir))
      fs.rmdirSync(tmpDir, {recursive: true});
    console.warn = originalConsoleWarn;
  });

  function createRuleFile(filename) {
    fs.openSync(path.join(tmpDir, filename), "w");
  }

  function getRulesArrayFrom(dir) {
    return JSON.parse(
      generateFragment(dir, null, null)).rule_resources;
  }

  it("throws an error if rules directory does not exist", () => {
    fs.rmdirSync(tmpDir, {recursive: true});
    expect(() => generateFragment(tmpDir)).toThrow(Error);
  });

  it("returns empty array for empty dir", () => {
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
  });

  it("warns on empty dir", () => {
    expect(warnings.length).toEqual(0);
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
    expect(warnings.length).toEqual(1);
  });

  it("ignores not subscriptions files", () => {
    createRuleFile("jsfile.js");
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
  });

  it("warns on not subscription files", () => {
    expect(warnings.length).toEqual(0);
    createRuleFile("jsfile.js");
    createRuleFile(VALID_RULESET_FILE);
    generateFragment(tmpDir, null, null);
    expect(warnings.length).toEqual(1);
  });

  it("returns single rule", () => {
    createRuleFile(VALID_RULESET_FILE);
    let fragment = generateFragment(tmpDir, null, null);
    expect(JSON.parse(fragment)["rule_resources"].length).toEqual(1);
  });

  it("returns valid rule id", () => {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    expect(getRulesArrayFrom(tmpDir)[0].id).toEqual(filename);
  });

  it("returns rules disabled by default", () => {
    createRuleFile(VALID_RULESET_FILE);
    expect(getRulesArrayFrom(tmpDir)[0].enabled).toEqual(false);
  });

  it("returns proper file path", () => {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    expect(getRulesArrayFrom(tmpDir)[0].path).toEqual(filename);
  });

  it("returns proper file path with prefix", () => {
    const filename = VALID_RULESET_FILE;
    createRuleFile(filename);
    const prefix = "subscriptions/";
    let rules = JSON.parse(
      generateFragment(tmpDir, prefix, null)).rule_resources;
    expect(rules[0].path).toEqual(prefix + filename);
  });

  it("returns multiple rules", () => {
    createRuleFile(VALID_RULESET_FILE);
    createRuleFile(VALID_RULESET_FILE2);
    expect(getRulesArrayFrom(tmpDir).length).toEqual(2);
  });

  it("prettifies JSON if space is passed", () => {
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
