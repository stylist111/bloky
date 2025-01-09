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

import {isMain} from "./utils.js";

async function run() {
  let subsInput = [
    path.join(process.cwd(), "adblockpluscore", "data", "subscriptions.json"),
    path.join(process.cwd(), "test", "scripts", "custom-subscriptions.json")
  ];
  let scriptsOutputDir = path.join(process.cwd(), "scriptsOutput");
  let subsOutput = path.join(scriptsOutputDir, "custom-mv2-subscriptions.json");

  console.log(`Merging MV2 subscriptions from ${subsInput}...`);
  await fs.promises.mkdir(scriptsOutputDir, {recursive: true});
  await promisify(exec)(`npm run subs-merge -- -i ${subsInput.join(" ")} -o ${subsOutput}`);

  console.log(`✅ Subscriptions merged to ${subsOutput}`);
}

if (isMain(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
