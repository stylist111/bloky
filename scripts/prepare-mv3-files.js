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

async function addExtraTestSubscription() {
  let subscriptionFileName = "00000000-0000-0000-0000-000000000002";
  console.log(`Creating the test subscription file: ${subscriptionFileName} `);
  await fs.promises.writeFile(path.join(process.cwd(), "scriptsOutput", "subscriptions",
                                        subscriptionFileName), "");
}

async function run() {
  await cleanup();

  let customSubscriptionFile = path.join(process.cwd(), "test", "scripts", "custom-mv3-subscriptions.json");
  let customSubscriptionsOutput = path.join(process.cwd(), "scriptsOutput", "custom-subscriptions.json");

  console.log(`Building subscriptions and rulesets from ${customSubscriptionFile}. This might take a while...`);
  await fs.promises.mkdir(path.dirname(customSubscriptionsOutput));

  await promisify(exec)(`npm run subs-merge -- -i ${customSubscriptionFile} -o ${customSubscriptionsOutput}`);
  await promisify(exec)("npm run subs-fetch");
  await promisify(exec)("npm run subs-convert");
  await promisify(exec)("npm run subs-generate -- -p rulesets/");

  await addExtraTestSubscription();

  console.log("✅ Rulesets and subscriptions generated. Please see the output in the `scriptsOutput` directory");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
