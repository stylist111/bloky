#!/usr/bin/env node
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

import fs from "fs";
import yargs from "yargs";
import path from "path";
import {hideBin} from "yargs/helpers";

import {filenameMv3} from "./initSubscriptions.js";
import {isMain} from "./utils.js";

export const filename = path.join("scriptsOutput", "custom-mv3-subscriptions.json");

export async function merge(fromFiles, toFile, space = 2) {
  let result = [];
  for (let fromFile of fromFiles) {
    if (!fs.existsSync(fromFile)) {
      throw new Error(
        `Subscriptions file (${fromFile}) does not exist.`);
    }
    let fromFileContent = JSON.parse(
      await fs.promises.readFile(fromFile));
    result = result.concat(fromFileContent);
  }
  await fs.promises.writeFile(toFile, JSON.stringify(
    result, null, space));
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      array: true,
      requiresArg: true,
      description: "Input file(s)"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output file"
    })
    .option("space", {
      alias: "s",
      type: "number",
      requiresArg: true,
      description: "JSON space (indentation)"
    })
    .parse();

  let inFiles = args.input || [filenameMv3];
  let outFile = args.output || filename;
  await merge(inFiles, outFile, args.space);
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
