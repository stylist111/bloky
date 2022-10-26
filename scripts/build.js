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

import {exec, spawn} from "child_process";

import yargs from "yargs";
import {hideBin} from "yargs/helpers";

let testServer;
async function killTestServer() {
  if (testServer) {
    await new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error("Could not stop test server"));
      }, 5000);

      function onClose() {
        testServer.off("close", onClose);
        testServer = null;
        console.log("✅ Test server has been stopped");
        resolve();
        clearTimeout(timeout);
      }
      testServer.on("close", onClose);
      testServer.kill("SIGKILL");
    });
  }
}

function runTestServer() {
  console.log("Test server starting...");
  testServer = spawn("test/start-server.js");

  return new Promise((resolve, reject) => {
    let log = [];
    let testPagesServerStarted = false;

    function removeListeners() {
      testServer.stderr.off("data", onData);
      testServer.stdout.off("data", onData);
      testServer.off("close", onClose);
    }

    function onData(data) {
      log.push(data);
      if (data.includes("listening at http://localhost:3000"))
        testPagesServerStarted = true;

      if (testPagesServerStarted) {
        console.log("✅ Test server started");
        removeListeners();
        resolve();
      }
    }

    function onClose(code) {
      if (code != 0) {
        console.log(log.join("\n"));
        removeListeners();
        reject(new Error("Failed to start test server"));
      }
    }

    testServer.stderr.on("data", onData);
    testServer.stdout.on("data", onData);
    testServer.on("close", onClose);
  });
}

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

  await runTestServer();

  try {
    console.log("Downloading bundled subscriptions...");
    await runCommand("npm run subs-run");
  }
  finally {
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

async function run() {
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
        .parse();

  await subsRun(args);
  await build(args);
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

async function cleanInterrupt() {
  await killTestServer();
  process.exit(1);
}

process.on("SIGINT", cleanInterrupt);
process.on("SIGTERM", cleanInterrupt);
