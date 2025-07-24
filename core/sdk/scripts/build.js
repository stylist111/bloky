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

import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {runSDKTestServer, killSDKTestServer} from "@eyeo/test-utils/test-server-manager";

import {isMain, runCommand} from "../scripts/utils.js";

const isScriptInvokedFromCLI = isMain(import.meta.url);

async function subsRunMV3(args) {
  let configNames = args["config-name"];
  // we only need subs-run for test-mv3 and performance-mv3 at this point.
  if (configNames && !configNames.toString().includes("mv3")) {
    return;
  }

  if (args["force-subscription-update"]) {
    console.log("Clearing any existing bundled subscriptions...");
    await runCommand("npm run subs-clean");
  }

  if (!args["use-external-server"] && isScriptInvokedFromCLI) {
    await runSDKTestServer();
  }

  try {
    console.log("Downloading bundled subscriptions...");

    await runCommand("npm run subs-run-mv3");
    await runCommand("npm run subs-run-performance-mv3");
  }
  finally {
    if (isScriptInvokedFromCLI) {
      await killSDKTestServer();
    }
  }
}

async function build(args) {
  console.log("Building...");
  let command = "npx webpack";
  if (args.env) {
    command += ` --env ${args.env}`;
  }

  if (args.configName) {
    command += ` --config-name ${args.configName.join(" ")}`;
  }

  if (args.devtool == false) {
    command += " --no-devtool";
  }

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
          choices: ["engine", "test-mv2", "test-mv3", "performance-mv3"],
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

  await subsRunMV3(args);
  // subsRunMV3 cleans the whole scriptsOutput directory.
  // That's why subs-run-mv2 needs to run afterwards
  await runCommand("npm run subs-run-mv2");
  await build(args);
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

async function cleanInterrupt() {
  await killSDKTestServer();
  process.exit(1);
}

process.on("SIGINT", cleanInterrupt);
process.on("SIGTERM", cleanInterrupt);
