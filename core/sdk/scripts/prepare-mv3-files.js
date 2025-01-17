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
import path from "path";

import {commonRun} from "./prepare-mv3-common.js";
import {cleanup} from "./clean-mv3-files.js";
import {isMain} from "./utils.js";

async function addExtraTestSubscription(outputDir) {
  let subscriptionFile = "00000000-0000-0000-0000-000000000002";
  console.log(`Creating the test subscription file: ${subscriptionFile}`);

  const outputPath = path.join(outputDir, "subscriptions", subscriptionFile);
  await fs.promises.writeFile(outputPath, "[Adblock Plus]");
}

async function run() {
  const scriptsOutputDir = path.join(process.cwd(), "scriptsOutput", "test-mv3");
  const subsInput = path.join(process.cwd(), "test", "scripts", "custom-subscriptions.json");

  await cleanup(scriptsOutputDir);
  await commonRun(subsInput, scriptsOutputDir);
  await addExtraTestSubscription(scriptsOutputDir);
}

if (isMain(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
