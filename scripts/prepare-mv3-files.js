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

/* eslint-env node */

import fs from "fs";
import {promisify} from "util";
import {exec} from "child_process";
import path from "path";

import {cleanup} from "./clean-mv3-files.js";
import {isMain} from "./utils.js";

async function addExtraTestSubscription() {
  let subscriptionFileName = "00000000-0000-0000-0000-000000000002";
  console.log(`Creating the test subscription file: ${subscriptionFileName} `);
  let outputPath = path.join(
    process.cwd(), "scriptsOutput", "subscriptions", subscriptionFileName
  );
  await fs.promises.writeFile(outputPath, "[Adblock Plus]");
}

async function readFile(filePath) {
  let contents = await fs.promises.readFile(filePath, {encoding: "utf-8"});
  return contents.trim();
}

async function writeCustomMV3Subscriptions() {
  let data = await readFile(path.join(process.cwd(), "test", "scripts", "custom-mv3-subscriptions.json"));
  let text = `const customMV3Subscriptions = ${data.toString()};`;
  await fs.promises.writeFile(path.join(process.cwd(), "scriptsOutput", "custom-mv3-subscriptions.js"), text, {encoding: "utf-8"});
}

export async function checkPreviousRun(subsInput, scriptsOutputDir,
                                       subsOutput) {
  try {
    let subsOutputContents = await readFile(subsOutput);
    let subsInputContents = await readFile(subsInput);

    if (subsOutputContents != subsInputContents) {
      return false;
    }

    let expectedSubs = JSON.parse(subsOutputContents);
    for (let sub of expectedSubs) {
      let expectedRuleset = path.join(scriptsOutputDir, "rulesets", sub.id);
      let expectedSub = path.join(scriptsOutputDir, "subscriptions", sub.id);
      await fs.promises.access(expectedRuleset);
      await fs.promises.access(expectedSub);
    }
    return true;
  }
  catch (e) {
    if (e.code != "ENOENT") {
      console.log(`Error: ${JSON.stringify(e)}`);
      console.log("Error while checking previous MV3 files. " +
                  "Falling back to clean build.");
    }
    return false;
  }
}

async function run() {
  let subsInput = path.join(
    process.cwd(), "test", "scripts", "custom-mv3-subscriptions.json"
  );
  let scriptsOutputDir = path.join(process.cwd(), "scriptsOutput");
  let subsOutput = path.join(scriptsOutputDir, "custom-subscriptions.json");

  if (await checkPreviousRun(subsInput, scriptsOutputDir, subsOutput)) {
    console.log("✅ Using already generated rulesets and subscriptions.");
    return;
  }

  await cleanup();

  console.log(`Building subscriptions and rulesets from ${subsInput}. ` +
              "This might take a while...");
  await fs.promises.mkdir(scriptsOutputDir);

  await promisify(exec)(`npm run subs-merge -- -i ${subsInput} -o ${subsOutput}`);
  await promisify(exec)("npm run subs-fetch");
  await promisify(exec)("npm run subs-convert");
  await promisify(exec)("npm run subs-generate -- -p rulesets/");

  await addExtraTestSubscription();
  await writeCustomMV3Subscriptions();

  console.log("✅ Rulesets and subscriptions generated. " +
              "Please see the output in the `scriptsOutput` directory");
}

if (isMain(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
