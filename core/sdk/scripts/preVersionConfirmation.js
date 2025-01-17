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

import * as readline from "node:readline/promises";
import {stdin, stdout} from "node:process";

import {ReleaseNotes} from "./releaseNotes.js";
import {isMain} from "../scripts/utils.js";
const isScriptInvokedFromCLI = isMain(import.meta.url);

async function run() {
  let releaseNotes = await ReleaseNotes.readFromDefaultFilepath();
  console.log(releaseNotes.unreleasedNotes());
  console.log();

  let rl = readline.createInterface({input: stdin, output: stdout});
  let answer = await rl.question("Is this the version you want to release? (yes / no) ");
  rl.close();

  let userIsSure = answer.toLowerCase().startsWith("y");
  if (!userIsSure) {
    process.exit(1);
  }
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
