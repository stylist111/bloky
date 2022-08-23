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

  if (usingTestSubscriptions)
    await addExtraTestSubscription();
  else
    // This is needed because we currently get more than
    // the allowed number of recommended subscriptions.
    await removeOverflowRulesets();

  console.log("✅ Rulesets and subscriptions generated. Please see the output in the `scriptsOutput` directory");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
