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
import {convert} from "../../scripts/convertSubscriptions.js";

const encoding = "utf-8";

describe("convertSubscriptions script", () => {
  let dirPath;
  let tmpInDir;
  let tmpOutDir;
  let originalConsoleWarn;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  beforeEach(function() {
    dirPath = path.join(os.tmpdir(), "convert-");
    tmpInDir = fs.mkdtempSync(dirPath);
    tmpOutDir = fs.mkdtempSync(dirPath);
    originalConsoleWarn = console.warn;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(function() {
    if (fs.existsSync(tmpInDir))
      fs.rmdirSync(tmpInDir, {recursive: true});
    if (fs.existsSync(tmpOutDir))
      fs.rmdirSync(tmpOutDir, {recursive: true});
    console.warn = originalConsoleWarn;
  });

  function createAbpRuleFile(filename, content) {
    let fullFilename = path.join(tmpInDir, filename);
    fs.openSync(fullFilename, "w");
    fs.writeFileSync(fullFilename, content, {encoding});
  }

  function getDnrRulesFromFile(filename) {
    let fullFilename = path.join(tmpOutDir, filename);
    return JSON.parse(fs.readFileSync(fullFilename, encoding));
  }

  it("does not filter regex rules", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\n/rule1/\nrule2");
    await convert(tmpInDir, tmpOutDir);
    let dnrRules = getDnrRulesFromFile(filename);
    expect(dnrRules.length).toEqual(2);
    expect(dnrRules[0].condition.regexFilter).toEqual("rule1");
    expect(dnrRules[1].condition.urlFilter).toEqual("rule2");
  });

  it("adds rule ids", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\nrule1\nrule2");
    await convert(tmpInDir, tmpOutDir);
    let dnrRules = getDnrRulesFromFile(filename);
    expect(dnrRules.length).toEqual(2);
    expect(dnrRules[0].id).toEqual(expect.any(Number));
    expect(dnrRules[1].id).toEqual(expect.any(Number));
  });
});
