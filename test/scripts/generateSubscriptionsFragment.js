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

  it("ignores not .json files", () => {
    createRuleFile("jsfile.js");
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[]}');
  });

  it("warns on not .json files", () => {
    expect(warnings.length).toEqual(0);
    createRuleFile("jsfile.js");
    createRuleFile("file.json");
    generateFragment(tmpDir, null, null);
    expect(warnings.length).toEqual(1);
  });

  it("returns single rule", () => {
    createRuleFile("singleFile.json");
    let fragment = generateFragment(tmpDir, null, null);
    expect(JSON.parse(fragment)["rule_resources"].length).toEqual(1);
  });

  it("returns valid rule id", () => {
    // assuming file name without extension is taken as rule id
    const baseFilename = "singleFile";
    createRuleFile(baseFilename + ".json");
    expect(getRulesArrayFrom(tmpDir)[0].id).toEqual(baseFilename);
  });

  it("returns rules disabled by default", () => {
    createRuleFile("singleFile.json");
    expect(getRulesArrayFrom(tmpDir)[0].enabled).toEqual(false);
  });

  it("returns proper file path", () => {
    const filename = "singleFile.json";
    createRuleFile(filename);
    expect(getRulesArrayFrom(tmpDir)[0].path).toEqual(filename);
  });

  it("returns proper file path with prefix", () => {
    const filename = "singleFile.json";
    createRuleFile(filename);
    const prefix = "subscriptions/";
    let rules = JSON.parse(
      generateFragment(tmpDir, prefix, null)).rule_resources;
    expect(rules[0].path).toEqual(prefix + filename);
  });

  it("returns multiple rules", () => {
    createRuleFile("multipleFile1.json");
    createRuleFile("multipleFile2.json");
    expect(getRulesArrayFrom(tmpDir).length).toEqual(2);
  });

  it("prettifies JSON if space is passed", () => {
    createRuleFile("file.json");
    expect(generateFragment(tmpDir, null, null))
      .toEqual('{"rule_resources":[{"id":"file","enabled":false,"path":"file.json"}]}');
    expect(generateFragment(tmpDir, null, 2)).toEqual(
`{
  "rule_resources": [
    {
      "id": "file",
      "enabled": false,
      "path": "file.json"
    }
  ]
}`);
    expect(generateFragment(tmpDir, null, "\t")).toEqual(
`{
\t"rule_resources": [
\t\t{
\t\t\t"id": "file",
\t\t\t"enabled": false,
\t\t\t"path": "file.json"
\t\t}
\t]
}`);
  });
});
