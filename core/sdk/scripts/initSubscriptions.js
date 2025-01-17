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
import {exists, download, isMain} from "./utils.js";
import path from "path";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

export const backendUrl = "https://easylist-downloads.adblockplus.org/v3/index.json";
export const filenameMv3 = "scriptsOutput/subscriptions_mv3.json";

export async function init(filename, url = backendUrl) {
  if (await exists(filename)) {
    console.warn("The output file exists and will be overwritten");
    await fs.promises.unlink(filename);
  }
  let toDir = path.dirname(filename);
  if (!(await exists(toDir))) {
    await fs.promises.mkdir(toDir, {recursive: true});
  }
  await download(url, filename);
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output file"
    })
    .option("url", {
      alias: "u",
      type: "string",
      requiresArg: true,
      description: "The index URL (to override the default URL)"
    })
    .parse();

  let filename = args.output || filenameMv3;
  let url = args.url || backendUrl;
  await init(filename, url);
  console.log(`Subscriptions file (${filename}) generated.`);
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
