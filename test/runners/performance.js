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
import lighthouse from "lighthouse";
import {By, until} from "selenium-webdriver";
import {BROWSERS} from "@eyeo/get-browser-binary";

import {getHandle, getDriver, writeScreenshot} from "./utils.js";

const remoteDebuggingPort = 33559;

function parseArguments() {
  try {
    let parser = yargs(process.argv.slice(2)).exitProcess(false);
    parser.version(false);
    parser.strict();
    parser.command("$0 <manifest> <browser> [version]", "", subparser => {
      subparser.positional("manifest", {choices: ["v2", "v3"]});
      subparser.positional("browser", {choices: Object.keys(BROWSERS)});
      subparser.positional("version", {type: "string", default: "latest"});
    });
    parser.option("forceHeadful", {
      description: "Run the tests in non headless mode."
    });

    let {manifest, browser, version} = parser.argv;
    let params = {};
    for (let param of ["forceHeadful"]) {
      let value = parser.argv[param];
      if (typeof value != "undefined") {
        params[param] = value;
      }
    }

    return {manifest, browser, version, params};
  }
  catch (error) {
    throw new Error(error.message);
  }
}

async function waitForPerformanceExtension(driver, browser) {
  if (browser == "firefox") {
    throw new Error("Firefox is not supported by the performance tests");
  }

  console.log("Waiting for performance extension ...");
  await getHandle(driver, "/status.html", 25000);
  let elem = await driver.findElement(By.id("status"));
  if ((await elem.getAttribute("errors")) == "true") {
    let errors = [];
    for (let error of await elem.findElements(By.css("ul"))) {
      errors.push(await error.getAttribute("innerText"));
    }
    throw new Error(errors.join("\n"));
  }
}

async function runLighthouseTest(driver) {
  const url = "https://www.example.com";
  const options = {
    logLevel: "silent",
    output: "json",
    onlyCategories: ["performance"],
    port: remoteDebuggingPort
  };

  console.log(`\nRunning lighthouse on ${url} ...`);
  const {lhr} = await lighthouse(url, options);

  console.log({runWarnings: lhr.runWarnings});
  const metrics = ["first-contentful-paint", "interactive", "total-blocking-time"];

  for (let metric of metrics) {
    let value = Math.trunc(lhr.audits[metric].numericValue);
    console.log(`${metric}: ${value}ms`);
  }
}

async function runHistoryTest(driver) {
  const failure = "History test FAILED";

  const url = "https://dev.motiv.fm";
  console.log(`\nRunning history test on ${url} ...`);
  await driver.navigate().to(url);

  const sidebarCss = ".layout-sidebar__menu > .layout-menu-menu-list__item > a";
  let sidebarLinks = await driver.findElements(By.css(sidebarCss));

  // Make sure sidebar elements are not initially stale
  let becameStale = false;
  for (let elem of sidebarLinks) {
    try {
      await driver.wait(until.stalenessOf(elem), 500);
      becameStale = true;
    }
    catch (e) {} // Sidebar elements may never become stale
  }
  if (becameStale) {
    sidebarLinks = await driver.findElements(By.css(sidebarCss));
  }

  if (sidebarLinks.length < 2) {
    throw new Error(`${failure}: At least 3 sidebar links are expected`);
  }

  let currentUrl;
  for (let elem of sidebarLinks) {
    try {
      await elem.click();
    }
    catch (err) {
      await writeScreenshot(driver, "screenshot.png");
      if (err.name == "StaleElementReferenceError") {
        throw new Error(`${failure}: Clicking on a stale element`);
      }
      else {
        throw err;
      }
    }

    let nextUrl;
    await driver.wait(async() => {
      nextUrl = await driver.getCurrentUrl();
      return nextUrl != currentUrl;
    }, 1000, `${failure}: Clicking an element didn't load a new URL. Current: ${currentUrl}`);
    currentUrl = nextUrl;
  }

  console.log("History test OK.");
}

export async function run() {
  const {manifest, browser, version, params} = parseArguments();
  const headless = !params.forceHeadful;
  const extensionPaths =
    [path.resolve(process.cwd(), "dist", `performance-m${manifest}`)];
  const extraArgs = [`--remote-debugging-port=${remoteDebuggingPort}`,
                     "--window-size=1920,1080"];

  console.log(`Getting ready to run ${browser} ${version} ...`);

  let driver;
  const options = {extensionPaths, extraArgs, headless};
  try {
    driver = await getDriver(browser, version, options);
    await waitForPerformanceExtension(driver, browser);
    await runLighthouseTest(driver);
    await runHistoryTest(driver);
  }
  finally {
    if (driver) {
      await driver.quit();
    }
  }
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
