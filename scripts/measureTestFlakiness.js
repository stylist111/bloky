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
      .option("runOnlyFlaky", {
        type: "string",
        default: "false",
        description: "Set to true if you want to run only flaky tests"
      })
      .option("buildFlags", {
        type: "string",
        default: "",
        description: "extra flags to pass to docker build"
      })
      .option("dockerRunFlags", {
        type: "string",
        default: "--cpus=2 --memory=8g --shm-size=1g",
        description: "extra flags to pass to docker run"
      })
      .option("runs", {
        type: "number",
        default: 10,
        description: "Number of tests runs to perform"
      })
      .parse();

const execOptions = {stdio: "inherit"};

// BUILDING CONTAINER
// we need to remove "v2"/ "v3" from the command
let testParams = args.testParams.split(" ").slice(1).join(" ");

// we need to remove everything after the version
testParams = testParams.includes("--") ? testParams.substring(0, testParams.indexOf("--")) : testParams;
// We need to create build flag here because "--build-arg" is
// not passed properly
// when invoking through the command line
let additionalBuildFlags = args.buildFlags ? `--build-arg ${args.buildFlags}` : "";
let buildCommand = `docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg "BROWSER=${testParams}" ${additionalBuildFlags} .`;
console.log(`Command that will be used for building container: ${buildCommand}`);

execSync(buildCommand, execOptions);

// RUNNING CONTAINER
let platformOpt = process.arch == "arm64" ? "--platform linux/amd64" : "";
let command = `docker run ${platformOpt} ${args.dockerRunFlags} -e TEST_PARAMS="${args.testParams}" -e RUN_ONLY_FLAKY="${args.runOnlyFlaky}" functional`;
console.log(`This command will be run ${args.runs} times: ${command}`);
let failureCount = 0;
let errorsThrown = [];

for (let run = 0; run < args.runs; run++) {
  console.log(`Running attempt ${run + 1} out of ${args.runs}`);
  if (run > 0) {
    let currentFailureRate = Math.round(failureCount / run * 100);
    console.log(`${failureCount} failures so far. Current failure rate: ${currentFailureRate}%`);
  }

  try {
    execSync(command, execOptions);
    console.log("Test succeeded!");
  }
  catch (error) {
    failureCount++;
    errorsThrown.push(run + 1);
  }
}

let failureRate = Math.round(failureCount / args.runs * 100);
console.log(`${failureCount} failures out of ${args.runs} attempts. Failure rate: ${failureRate}%`);

if (failureCount > 2) {
  console.log("Run attempts that failed: ", errorsThrown.join(", "), "scroll up for more details");
  throw new Error("Test failed!");
}
