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

/* eslint-disable no-console */

import { spawn } from "child_process";
import fs from "fs";

import { runTestServer, killTestServer, buildHelperExtension } from "../index.js";

// Extract command-line arguments after the script name
// e.g., --grep "Smoke"
const args = process.argv.slice(2);

// Global timeout for test cases. Test cases expected to take longer time to run
// use `this.timeout()` to set an individual higher timeout.
const globalTimeout = 30000;

// Removes the screenshots folder
async function removeScreenshots(screenshotsPath) {
  await fs.promises.rm(screenshotsPath, { recursive: true, force: true });
}

async function runMochaTests(config) {
  const { runnersPath } = config;

  return new Promise((resolve, reject) => {
    const mochaProcess = spawn(
      "mocha",
      // Add the "--parallel" flag to run tests in parallel.
      // Ensure the real-time logging can work in parallel before doing that and
      // the CI server can handle the increased load.
      [runnersPath, "--timeout", globalTimeout, ...args],
      { stdio: "inherit" },
    );

    mochaProcess.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(`Mocha exited with code ${code}`));
    });
  });
}

export async function runE2ETests(config) {
  const { screenshotsPath, helperExtensionPath } = config;

  await buildHelperExtension(process.env.MANIFEST_VERSION, helperExtensionPath);
  console.log(`Helper extension built to ${helperExtensionPath}`);

  await runTestServer();

  try {
    await removeScreenshots(screenshotsPath);
    await runMochaTests(config);
  } finally {
    console.log("Stopping test server...");
    await killTestServer();
  }
}
