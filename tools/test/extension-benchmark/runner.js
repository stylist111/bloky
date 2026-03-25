/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-env node */
/* eslint-disable no-console */

import fs from "fs";

import yargs from "yargs";

import { quitDriver } from "../sdk-runner/driver.js";
import {
  benchmarkRun,
  resultsPath,
  extensionsPath,
  urlsFilePath,
  buildReport,
} from "./benchmark.js";

export function parseArguments() {
  try {
    const parser = yargs(process.argv.slice(2));
    parser.version(false);
    parser.strict();
    parser.command("$0 <browser> [version]", "", (subparser) => {
      subparser.positional("browser", { choices: ["chromium", "edge"] });
      subparser.positional("version", { type: "string", default: "latest" });
    });
    parser.option("forceHeadful", {
      description: "Run the tests in non headless mode",
    });
    parser.option("runsPerURL", {
      description: "How many times the same URL will be measured",
      type: "number",
      default: 2,
    });
    parser.option("restartBrowser", {
      description: "Use a new browser instance after each URL run",
    });
    parser.option("sleepPostInstall", {
      description: "Amount of seconds to sleep after the post install page",
      type: "number",
      default: 0,
    });

    const { browser, version } = parser.argv;
    const params = {};
    for (const param of [
      "help",
      "forceHeadful",
      "runsPerURL",
      "restartBrowser",
      "sleepPostInstall",
    ]) {
      const value = parser.argv[param];
      if (typeof value !== "undefined") {
        params[param] = value;
      }
    }

    return { browser, version, params };
  } catch (error) {
    throw new Error(error.message);
  }
}

async function readURLs() {
  let urlsFile;
  try {
    urlsFile = await fs.promises.readFile(urlsFilePath);
    if (!urlsFile.toString()) {
      throw new Error("Empty URLs file");
    }
  } catch (e) {
    throw new Error(`${e.message}. Please copy '${urlsFilePath}.tmpl' to '${urlsFilePath}'`);
  }
  // filter(n => n) removes empty lines
  return urlsFile
    .toString()
    .split("\n")
    .filter((n) => n);
}

async function run() {
  const { browser, version, params } = parseArguments();

  // Cleanup results folder
  await fs.promises.rm(resultsPath, { force: true, recursive: true });
  await fs.promises.mkdir(resultsPath, { recursive: true });

  const urls = await readURLs();
  const extensions = (await fs.promises.readdir(extensionsPath, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  extensions.push(null); // add run with no extension

  for (const extension of extensions) {
    try {
      await benchmarkRun(extension, urls, { browser, version, params });
    } finally {
      await quitDriver();
    }
  }

  await buildReport();
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
