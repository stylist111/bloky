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

import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {execSync} from "child_process";

const args = yargs(hideBin(process.argv))
      .version(false)
      .option("testParams", {
        type: "string",
        default: "v2 chromium",
        description: "Which tests to run"
      })
      .option("dockerFlags", {
        type: "string",
        default: "--cpus=1 --memory=3.75g --shm-size=512m",
        description: "extra flags to pass to docker"
      })
      .option("runs", {
        type: "number",
        default: 10,
        description: "Number of tests runs to perform"
      })
      .parse();

const execOptions = {stdio: "inherit"};

let command = `docker run ${args.dockerFlags} -v "${process.cwd()}/browser-snapshots:/webext-sdk/browser-snapshots" -e TEST_PARAMS="${args.testParams}" -it functional`;
console.log(`This command will be run ${args.runs} times: ${command}`);

console.log("Building container");
let buildCommand = "docker build -t functional -f test/dockerfiles/functional.Dockerfile .";
execSync(buildCommand, execOptions);

let failureCount = 0;

for (let i = 0; i < args.runs; i++) {
  console.log(`Running attempt ${i + 1} out of ${args.runs}`);
  if (i > 0) {
    let currentFailureRate = Math.round(failureCount / i * 100);
    console.log(`${failureCount} failures so far. Current failure rate: ${currentFailureRate}%`);
  }

  try {
    execSync(command, execOptions);
    console.log("Test succeeded!");
  }
  catch (e) {
    failureCount++;
    console.log(`Test failed! ${e}`);
  }
}

let failureRate = Math.round(failureCount / args.runs * 100);
console.log(`${failureCount} failures out of ${args.runs} attempts. Failure rate: ${failureRate}%`);
