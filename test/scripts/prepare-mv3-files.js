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

import {checkPreviousRun} from "../../scripts/prepare-mv3-files.js";

describe("prepare MV3 files script", function() {
  let tmpOutDir;
  let subsInput;
  let scriptsOutputDir;
  let subsOutput;
  let subsContent;

  beforeEach(async function() {
    let dirPath = path.join(os.tmpdir(), "prepare-mv3-files-");
    tmpOutDir = await fs.promises.mkdtemp(dirPath);
    subsInput = path.join(tmpOutDir, "custom-mv3-subscriptions.json");
    scriptsOutputDir = path.join(tmpOutDir, "scriptsOutput");
    subsOutput = path.join(scriptsOutputDir, "custom-subscriptions.json");

    subsContent = [{
      id: "00000000-0000-0000-0000-000000000000",
      type: "ads",
      title: "Test MV3 Custom Subscription",
      homepage: "http://localhost:3000/subscription.txt",
      url: "http://localhost:3000/subscription.txt",
      mv2_url: "http://localhost:3000/mv2_subscription.txt"
    }, {
      id: "00000000-0000-0000-0000-000000000010",
      type: "ads",
      title: "Test MV3 Custom Subscription 2",
      homepage: "http://localhost:3000/subscription.txt?2",
      url: "http://localhost:3000/subscription.txt?2",
      mv2_url: "http://localhost:3000/mv2_subscription.txt?2"
    }];

    await fs.promises.writeFile(subsInput, JSON.stringify(subsContent));
  });

  afterEach(function() {
    if (fs.existsSync(tmpOutDir)) {
      fs.rmdirSync(tmpOutDir, {recursive: true});
    }
  });

  async function createExpectedOutput() {
    await fs.promises.mkdir(scriptsOutputDir);
    await fs.promises.writeFile(subsOutput, JSON.stringify(subsContent));

    let rulesetsDir = path.join(scriptsOutputDir, "rulesets");
    let subscriptionsDir = path.join(scriptsOutputDir, "subscriptions");
    await fs.promises.mkdir(rulesetsDir);
    await fs.promises.mkdir(subscriptionsDir);

    for (let sub of subsContent) {
      await fs.promises.writeFile(path.join(rulesetsDir, sub.id), "[]");
      await fs.promises.writeFile(path.join(subscriptionsDir, sub.id), "");
    }
  }

  it("does a clean build if the scriptsOutput dir does not exist", async function() {
    expect(await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput))
      .toEqual(false);
  });

  it("does a clean build if the subscription list is out of date", async function() {
    await createExpectedOutput();

    subsContent.pop();
    await fs.promises.writeFile(subsOutput, JSON.stringify(subsContent));

    expect(await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput))
      .toEqual(false);
  });

  it("does a clean build if a ruleset file is missing", async function() {
    await createExpectedOutput();

    await fs.promises.rm(path.join(
      scriptsOutputDir, "rulesets", "00000000-0000-0000-0000-000000000000"
    ));

    expect(await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput))
      .toEqual(false);
  });

  it("does a clean build if a filter list is missing", async function() {
    await createExpectedOutput();

    await fs.promises.rm(path.join(
      scriptsOutputDir, "subscriptions", "00000000-0000-0000-0000-000000000010"
    ));

    expect(await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput))
      .toEqual(false);
  });

  it("uses the existing build if there are no changes", async function() {
    await createExpectedOutput();
    expect(await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput))
      .toEqual(true);
  });
});
