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
/* eslint-disable no-console */

import path from "path";

import yargs from "yargs";

import {getNewDriver, quitDriver, remoteDebuggingPort, waitForPerformanceExtension} from "./driver.js";
import {historyTest} from "../performance/history.js";
import {baselineRunsPerUrl, lighthouseTests} from "../performance/lighthouse.js";

function parseArguments() {
  try {
    let parser = yargs(process.argv.slice(2)).exitProcess(false);
    parser.version(false);
    parser.strict();
    parser.command("$0 <manifest> <browser> [version]", "", subparser => {
      subparser.positional("manifest", {choices: [2, 3]});
      subparser.positional("browser", {choices: ["chromium", "edge"]});
      subparser.positional("version", {type: "string", default: "latest"});
    });
    parser.option("forceHeadful", {
      description: "Run the tests in non headless mode."
    });
    parser.option("slow", {
      description: "Run the tests using the slow performance extension."
    });
    parser.option("saveBaseline", {
      description: `Run lighthouse ${baselineRunsPerUrl} times per URL and save the baseline file. Performance tests are skipped when this option is used.`
    });

    let {manifest, browser, version} = parser.argv;
    let params = {};
    for (let param of ["forceHeadful", "slow", "saveBaseline"]) {
      let value = parser.argv[param];
      if (typeof value != "undefined") {
        params[param] = value;
      }
    }

    // Chromium 128 is the latest supported version for MV2
    if (browser === "chromium" &&
        manifest === 2 &&
        version === "latest") {
      console.warn("Warning: using Chromium 128 as the latest supported version for MV2");
      version = "128.0.6613.0";
    }

    if (params.slow && manifest === 2) {
      throw new Error("The slow performance extension is not supported on MV2");
    }

    return {manifest, browser, version, params};
  }
  catch (error) {
    throw new Error(error.message);
  }
}

export async function run() {
  const {manifest, browser, version, params} = parseArguments();
  const headless = !params.forceHeadful;
  const extensionName = params.slow ? "slow-performance" : "performance";
  const extensionPaths =
    [path.resolve(process.cwd(), "dist", `${extensionName}-mv${manifest}`)];
  const extraArgs = [`--remote-debugging-port=${remoteDebuggingPort}`,
                     "--window-size=1920,1080"];

  console.log(`Getting ready to run ${browser} ${version} ...`);
  if (params.slow) {
    console.warn("WARNING: The slow performance extension is being used");
  }

  const options = {extensionPaths, extraArgs, headless};

  try {
    await getNewDriver(browser, version, options);
    await waitForPerformanceExtension(browser);

    await lighthouseTests(params.saveBaseline, {browser, version, options});
    if (!params.saveBaseline) {
      await historyTest();
    }
  }
  finally {
    await quitDriver();
  }
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
