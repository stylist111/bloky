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

import {filename} from "./mergeSubscriptions.js";
import {exists, download, isMain} from "./utils.js";
import fs from "fs";
import yargs from "yargs";
import path from "path";
import {hideBin} from "yargs/helpers";

export const OUTPUT_DIR = path.join("scriptsOutput", "subscriptions");

export function getSubscriptionFile(subscription) {
  return subscription.id;
}

export async function fetchSubscriptions(
  fromFile, toDir, ignoreFetchErrors = false) {
  if (await exists(toDir)) {
    console.warn("The output directory exists");
  }
  else {
    await fs.promises.mkdir(toDir, {recursive: true});
  }

  if (!(await exists(fromFile))) {
    throw new Error(
      `Subscriptions file (${fromFile}) does not exist. ` +
      "Please, generate it with `subs-init` and `subs-merge`.");
  }

  console.info("Downloading started");
  let subscriptions = await JSON.parse(
    await fs.promises.readFile(fromFile));
  for (let subscription of subscriptions) {
    let toFile = `${toDir}/${getSubscriptionFile(subscription)}`;
    let toTmpFile = toFile + ".tmp";
    try {
      await download(subscription.url, toTmpFile);
    }
    catch (e) {
      if (ignoreFetchErrors) {
        console.warn(`Downloading ${subscription.url} failed`);
        continue;
      }
      if (await exists(toTmpFile)) {
        await fs.promises.rm(toTmpFile);
      }
      throw e;
    }
    await fs.promises.rename(toTmpFile, toFile);
  }
  console.info("Downloading finished");
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      requiresArg: true,
      description: "Input file"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output directory"
    })
    .option("ignoreFetchErrors", {
      alias: "ife",
      type: "boolean",
      requiresArg: false,
      description: "Ignore fetch errors and continue"
    })
    .parse();
  let fromFile = args.input || filename;
  let toDir = args.output || OUTPUT_DIR;
  let ignoreFetchErrors = args.ignoreFetchErrors || false;
  await fetchSubscriptions(fromFile, toDir, ignoreFetchErrors);
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
