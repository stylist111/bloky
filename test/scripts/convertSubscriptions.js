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
  let tmpReportDir;
  let originalConsoleWarn;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  beforeEach(function() {
    dirPath = path.join(os.tmpdir(), "convert-");
    tmpInDir = fs.mkdtempSync(dirPath);
    tmpOutDir = fs.mkdtempSync(dirPath);
    tmpReportDir = fs.mkdtempSync(dirPath);
    originalConsoleWarn = console.warn;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(function() {
    if (fs.existsSync(tmpInDir))
      fs.rmdirSync(tmpInDir, {recursive: true});
    if (fs.existsSync(tmpOutDir))
      fs.rmdirSync(tmpOutDir, {recursive: true});
    if (fs.existsSync(tmpReportDir))
      fs.rmdirSync(tmpReportDir, {recursive: true});
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

  // Get the DNR rules map from the rules file named `filename`.
  function getDnrRulesMapFromRulesFile(filename) {
    let fullFilename = path.join(tmpOutDir, filename + ".map");
    return JSON.parse(fs.readFileSync(fullFilename, encoding));
  }

  function getReportDataFromFile(filename) {
    let fullFilename = path.join(tmpReportDir, filename);
    return fs.readFileSync(fullFilename, encoding)
      .trim().split("\n").slice(1)
      .map(line => {
        let [
          filterText,
          modifyHeaders,
          allow,
          allowAllRequests,
          redirect,
          block,
          allTypes] = line.split("\t");

        return {
          filterText,
          modifyHeaders,
          allow,
          allowAllRequests,
          redirect,
          block,
          allTypes};
      });
  }

  function getSummaryReportData() {
    let fullFilename = path.join(tmpReportDir, "_reportSummary.csv");
    return fs
      .readFileSync(fullFilename, encoding)
      .trim().split("\n").slice(1)
      .map(line => {
        let [
          subsId,
          modifyHeaders,
          allow,
          allowAllRequests,
          redirect,
          block,
          allTypes,
          modifyHeadersMax,
          allowMax,
          allowAllRequestsMax,
          redirectMax,
          blockMax,
          content,
          url
        ] = line.split("\t");

        return {
          subsId,
          modifyHeaders,
          allow,
          allowAllRequests,
          redirect,
          block,
          allTypes,
          modifyHeadersMax,
          allowMax,
          allowAllRequestsMax,
          redirectMax,
          blockMax,
          content,
          url
        };
      });
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

  it("adds rule ids and map them", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\nrule1\nrule2");
    await convert(tmpInDir, tmpOutDir);
    let dnrRules = getDnrRulesFromFile(filename);
    expect(dnrRules.length).toEqual(2);
    expect(dnrRules[0].id).toEqual(expect.any(Number));
    expect(dnrRules[1].id).toEqual(expect.any(Number));

    let dnrMap = getDnrRulesMapFromRulesFile(filename);
    expect(dnrMap.length).toEqual(2);
    expect(dnrMap[0][0]).toEqual("rule1");
    expect(dnrMap[0][1]).toContain(dnrRules[0].id);
    expect(dnrMap[1][0]).toEqual("rule2");
    expect(dnrMap[1][1]).toContain(dnrRules[1].id);
  });

  it("generates a summary report file", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\n/rule1/\nrule2\n");
    await convert(tmpInDir, tmpOutDir, true, tmpReportDir);
    const reportSummaryFile = fs.existsSync(path.join(tmpReportDir, "_reportSummary.csv"));
    expect(reportSummaryFile).toBeTruthy();
  });

  it("generates a report for each subscription", async function() {
    let filename1 = "foo.txt";
    createAbpRuleFile(filename1, "[Adblock Plus 2.0]\n/rule1/\nrule2\n");
    let filename2 = "bar.txt";
    createAbpRuleFile(filename2, "[Adblock Plus 2.0]\n/rule1/\nrule2\n");
    let filename3 = "baz.txt";
    createAbpRuleFile(filename3, "[Adblock Plus 2.0]\n/rule1/\nrule2\n");
    await convert(tmpInDir, tmpOutDir, true, tmpReportDir);
    const folderContent = fs.readdirSync(tmpReportDir);
    const subscriptionNames = [filename1, filename2, filename3];
    expect(folderContent).toEqual(expect.arrayContaining(subscriptionNames));
  });

  it("generates the subscription data correctly", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\n/image-from-subscription.png^$image\n###elem-hide");
    await convert(tmpInDir, tmpOutDir, true, tmpReportDir);
    const reportContent = getReportDataFromFile(filename);
    expect(reportContent[0]).toEqual({
      filterText: "/image-from-subscription.png^$image",
      modifyHeaders: "0",
      allow: "0",
      allowAllRequests: "0",
      redirect: "0",
      block: "1",
      allTypes: "1"
    });
  });

  it("generates the summary data correctly", async function() {
    let filename = "foo.txt";
    createAbpRuleFile(filename, "[Adblock Plus 2.0]\n/image-from-subscription.png^$image\n###elem-hide");
    await convert(tmpInDir, tmpOutDir, true, tmpReportDir);
    const reportSummaryContent = getSummaryReportData(filename);
    expect(reportSummaryContent[0]).toEqual({
      subsId: filename,
      modifyHeaders: "0",
      allow: "0",
      allowAllRequests: "0",
      redirect: "0",
      block: "1",
      allTypes: "1",
      modifyHeadersMax: "0",
      allowMax: "0",
      allowAllRequestsMax: "0",
      redirectMax: "0",
      blockMax: "1",
      content: "1",
      url: "1"
    });
  });
});
