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
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {cleanup} from "./clean-mv3-files.js";

let rulesetFile = path.join(process.cwd(), "scriptsOutput", "rulesets", "rulesets.json");
const CHROMIUM_RULESETS_LIMIT = 50;

async function addExtraTestSubscription() {
  let subscriptionFileName = "00000000-0000-0000-0000-000000000002";
  console.log(`Creating the test subscription file: ${subscriptionFileName} `);
  await fs.promises.writeFile(path.join(process.cwd(), "scriptsOutput", "subscriptions",
                                        subscriptionFileName), "");
}

async function removeOverflowRulesets() {
  let content = JSON.parse(await fs.promises.readFile(rulesetFile));

  if (content.rule_resources.length <= CHROMIUM_RULESETS_LIMIT)
    return;

  console.warn(`${rulesetFile} contains more than ${CHROMIUM_RULESETS_LIMIT} ` +
               "rulesets. The overflow will be removed from the file");

  while (content.rule_resources.length > CHROMIUM_RULESETS_LIMIT)
    content.rule_resources.pop();

  await fs.promises.writeFile(rulesetFile, JSON.stringify(content));
}

async function removeStandaloneRulesets() {
  let content = JSON.parse(await fs.promises.readFile(rulesetFile));

  let standAloneSubscriptions = [
    "A4A32212-E6BD-45F6-AD0F-E0FD18E8537B", // ABPindo
    "1638B159-F64A-4307-84E7-16AB08ED409E", // Bulgarian list
    "6D489E8D-E61C-444C-BBC5-44741773ADC2", // Dandelion Sprout's Nordic Filters
    "2D8C4D88-34A0-4259-9098-30D28BA674BC", // EasyList Czech and Slovak
    "CB94E27D-6CD1-4DB9-83D9-6B7F1A3555F6", // EasyList Dutch
    "4337FB2B-A95C-44D5-B78D-11AD40F7711B", // EasyList Germany
    "2F0A4F0D-DF16-40D0-B0E0-5EB6791EC119", // EasyList Italy
    "E89B3C08-2DED-40EA-8EE1-339B90D7B451", // EasyList Lithuania
    "9F743FCD-801B-41D0-830F-5A4EA995216E", // EasyList Polish
    "A41441EE-BF7C-4A48-9A43-42CCEA2B2A1D", // EasyList Portuguese
    "C8C1AA76-15B4-4CA3-8A9C-AD38D6AFCAEC", // EasyList Spanish
    "9FAA2906-CD5C-4520-BDC4-4E098B7EA228", // IndianList
    "AE0D9320-665E-407D-B692-1A85AE481F34", // EasyList Hebrew
    "BCE2062F-0D99-4861-A1F7-E3DFEA6DAB69", // KoreanList
    "51893C6C-F39E-43C5-A2EF-9545E388A2CE", // Latvian List
    "3D60E303-1141-4775-B800-834177922876", // Liste AR
    "8D421590-1A68-4B68-BE50-04E17C09460E", // Liste FR
    "99166908-5FDA-4F9E-8C4C-70BB4DEEFC08", // ROList
    "879ECB9D-8935-4506-939E-5BBB7DD09402"  // RuAdList
  ];

  let replaced = content.rule_resources.filter(function(item){
    if (standAloneSubscriptions.indexOf(item.id) === -1)
      return item;
  });

  await fs.promises.writeFile(rulesetFile,
                              JSON.stringify({rule_resources: replaced}));
}

async function run() {
  const args = yargs(hideBin(process.argv))
  .option("type", {
    alias: "t",
    type: "string",
    description: "The type of subscription list to build with.",
    choices: ["test", "default"]
  })
  .parse();

  await cleanup();

  console.log("Building subscriptions and rulesets. This might take a while...");

  let usingTestSubscriptions = args.type == "test";
  if (usingTestSubscriptions) {
    let customSubscriptionFile = path.join(process.cwd(), "test", "scripts", "custom-mv3-subscriptions.json");
    let customSubscriptionsOutput = path.join(process.cwd(), "scriptsOutput", "custom-subscriptions.json");
    console.log(`Getting only the subscriptions in ${customSubscriptionFile}`);
    await fs.promises.mkdir(path.dirname(customSubscriptionsOutput));
    await promisify(exec)(`npm run subs-merge -- -i ${customSubscriptionFile} -o ${customSubscriptionsOutput}`);
  }
  else {
    console.log("Full run that should include all subscriptions");
    await promisify(exec)("npm run subs-init");
    await promisify(exec)("npm run subs-merge");
  }

  await promisify(exec)("npm run subs-fetch");
  await promisify(exec)("npm run subs-convert");
  await promisify(exec)("npm run subs-generate -- -p rulesets/");

  if (usingTestSubscriptions) {
    await addExtraTestSubscription();
  }
  else {
    // This removes the standalone items. Currently these are not used.
    await removeStandaloneRulesets();
    // This is needed because we currently get more than
    // the allowed number of recommended subscriptions.
    await removeOverflowRulesets();
  }

  console.log("✅ Rulesets and subscriptions generated. Please see the output in the `scriptsOutput` directory");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
