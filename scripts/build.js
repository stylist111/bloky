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

import {exec} from "child_process";

import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {runTestServer, killTestServer} from "./test-server-manager.js";
import {isMain} from "../scripts/utils.js";

const isScriptInvokedFromCLI = isMain(import.meta.url);

function runCommand(command) {
  console.log(`> ${command}`);
  return new Promise((resolve, reject) => {
    let process = exec(command, error => {
      if (error)
        reject(error);
      else
        resolve();
    });
    process.stdout.on("data", data => {
      console.log(data);
    });
    process.stderr.on("data", data => {
      console.error(data);
    });
  });
}

async function subsRun(args) {
  let configNames = args["config-name"];
  // we only need subs-run for test-mv3 at this point.
  if (configNames && !configNames.includes("test-mv3"))
    return;

  if (args["force-subscription-update"]) {
    console.log("Clearing any existing bundled subscriptions...");
    await runCommand("npm run subs-clean");
  }

  if (!args["use-external-server"])
    await runTestServer();

  try {
    console.log("Downloading bundled subscriptions...");
    await runCommand("npm run subs-run");
  }
  finally {
    if (isScriptInvokedFromCLI)
      await killTestServer();
  }
}

async function build(args) {
  console.log("Building...");
  let command = "npx webpack";
  if (args.env)
    command += ` --env ${args.env}`;

  if (args.configName)
    command += ` --config-name ${args.configName.join(" ")}`;

  if (args.devtool == false)
    command += " --no-devtool";

  await runCommand(command);
  console.log("✅ Building Completed");
}

export async function run() {
  const args = yargs(hideBin(process.argv))
        .option("env", {
          description: "Environment to build for. " +
            "Release builds are smaller and have testing code stripped out.",
          choices: ["release"]
        })
        .option("config-name", {
          description: "Name of the configuration to use.",
          choices: [
            "sdk", "sdk-subs", "test-mv2", "test-mv2-custom", "test-mv3"
          ],
          array: true
        })
        .option("no-devtool", {
          description: "Do not generate source maps.",
          boolean: true
        })
        .option("force-subscription-update", {
          description: "Always rebuild the bundled subscriptions.",
          boolean: true
        })
        .option("use-external-server", {
          description: "Does not start the test server. The test server must be running already.",
          boolean: true
        })
        .parse();

  await subsRun(args);
  await build(args);
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

async function cleanInterrupt() {
  await killTestServer();
  process.exit(1);
}

process.on("SIGINT", cleanInterrupt);
process.on("SIGTERM", cleanInterrupt);
