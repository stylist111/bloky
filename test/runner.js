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
import webdriver from "selenium-webdriver";
import {BROWSERS} from "@eyeo/get-browser-binary";

// Required to start the driver on some platforms (e.g. Windows).
import "chromedriver";
import "geckodriver";
import "msedgedriver";

function parseArguments() {
  let parser = yargs(process.argv.slice(2));
  parser.version(false);
  parser.strict();
  parser.command("$0 <manifest> <browser> [version]", "", subparser => {
    subparser.positional("manifest", {choices: ["v2", "v3", "v2-custom"]});
    subparser.positional("browser", {choices: Object.keys(BROWSERS)});
    subparser.positional("version", {type: "string"});
  });
  parser.option("incognito", {
    description: "Run the tests in incognito mode (Chrome) or private browsing (Firefox) - currently only supported on Firefox."
  });
  parser.option("timeout", {
    description: "Maximum running time for each test. 0 disables timeouts."
  });
  parser.option("testKinds", {
    description: "Which kinds of tests to run (by default all are run)",
    array: true,
    choices: ["functional", "reload", "fuzz"]
  });
  parser.option("grep");

  let {argv} = parser;
  let params;
  for (let param of ["timeout", "grep", "incognito"]) {
    let value = argv[param];
    if (typeof value != "undefined")
      (params || (params = {}))[param] = value;
  }

  let testKinds = argv.testKinds;
  // default is specified here rather than using a yargs default
  // because it depends on another yargs option (the manifest).
  if (!testKinds) {
    testKinds = ["functional", "reload"];
    if (manifestIsMV3(argv.manifest))
      testKinds.push("fuzz");
  }

  return {
    manifest: argv.manifest,
    browser: argv.browser,
    version: argv.version,
    testKinds,
    params
  };
}

async function switchToHandle(driver, testFn) {
  for (let handle of await driver.getAllWindowHandles()) {
    let url;
    try {
      await driver.switchTo().window(handle);
      url = await driver.getCurrentUrl();
    }
    catch (e) {
      continue;
    }

    if (testFn(url))
      return handle;
  }
}

async function getHandle(driver, page, timeout = 8000) {
  let url;
  let handle = await driver.wait(() => switchToHandle(driver, handleUrl => {
    if (!handleUrl)
      return false;

    url = new URL(handleUrl);
    return url.pathname == page;
  }), timeout, `${page} did not open`);

  return handle;
}

function manifestIsMV3(manifest) {
  return manifest.startsWith("v3");
}

async function setMinDriverTimeout(driver, timeout) {
  let driverTimeouts = await driver.manage().getTimeouts();
  let paramsTimeout = parseInt(timeout, 10);
  if (paramsTimeout == 0) {
    // 0 is a mocha special case to disable timeouts
    await driver.manage().setTimeouts({
      script: null
    });
  }
  else if (driverTimeouts.script && paramsTimeout > driverTimeouts.script) {
    await driver.manage().setTimeouts({
      script: paramsTimeout
    });
  }
}

async function pollMessages(driver, handle, isMV3) {
  let result;
  let webdriverEvents = [];
  let log = [];

  while (!result) {
    let messages;
    let script = `
      let webdriverEvents = arguments[0];
      return new Promise(resolve => {
        if (document.readyState == "complete")
          resolve(poll(webdriverEvents));
        else
          window.addEventListener("load", () => resolve(poll(webdriverEvents)));
      });`;
    try {
      messages = await driver.executeScript(script, webdriverEvents);
    }
    catch (err) {
      if (err.message.includes("received Inspector.detached event"))
        // From Chromium 105 the driver.executeScript function might throw
        // this error on low resource machines. Retrying usually helps.
        messages = await driver.executeScript(script, webdriverEvents);
      else
        throw err;
    }
    webdriverEvents = [];

    if (!messages)
      return;

    for (let [id, arg] of messages) {
      switch (id) {
        case "log":
          log.push(arg);
          console.log(...arg);
          break;

        case "click":
          await switchToHandle(driver, handleUrl => handleUrl == arg.url);
          await driver.findElement(webdriver.By.css(arg.selector)).click();
          await driver.switchTo().window(handle);
          webdriverEvents.push({id: "clicked", arg});
          break;

        case "suspendServiceWorker":
          // this is a noop for mv2, since there's no service worker to suspend.
          if (isMV3)
            await suspendServiceWorker(driver, handle);
          webdriverEvents.push({id: "serviceWorkerSuspended"});
          break;

        case "end":
          result = arg;
          result.log = log;
          break;
      }
    }
  }
  return result;
}

async function startTestRun(driver, id, params, incognito) {
  let search = new URLSearchParams();
  for (let key in params)
    search.append(key, params[key]);

  search = search.toString();

  // In incognito mode extension load is taking a bit longer
  await getHandle(driver, "/index.html", incognito ? 12000 : void 0);
  if (search) {
    let url = await driver.getCurrentUrl();
    let urlComponents = url.split("?");
    let currentPath = urlComponents[0];
    let currentSearch = urlComponents[1];
    if (!currentSearch || currentSearch != search)
      await driver.navigate().to(`${currentPath}?${search}`);
  }

  await driver.findElement(webdriver.By.id(id)).click();
}

async function runFunctionalTests(driver, params, isMV3, incognito) {
  console.log("================");
  console.log("Functional Tests");
  console.log("================");

  await startTestRun(driver, "functional", params, incognito);
  let handle = await getHandle(driver, "/functional.html");
  let results = await pollMessages(driver, handle, isMV3);
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function runReloadTests(driver, params, isMV3) {
  console.log("============");
  console.log("Reload Tests");
  console.log("============");

  let results;
  let handle;

  await startTestRun(driver, "reload");
  while (!results ||
         results.log.toString().includes("Reload (preparation)")) {
    // The 20s timeout covers rulesets delays when loading an MV3 extension
    handle = await getHandle(driver, "/reload.html", 20000);
    try {
      results = await pollMessages(driver, handle, isMV3);
    }
    catch (e) {
      if (e.name != "NoSuchWindowError")
        throw e;
    }
  }
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function runFuzzTests(driver, params, isMV3, incognito) {
  console.log("==========");
  console.log("Fuzz Tests");
  console.log("==========");

  if (!isMV3) {
    console.warn("Service worker fuzzing tests are only for MV3");
    return {failures: 0, total: 0, log: []};
  }

  let fuzzParams = {...params, fuzzServiceWorkers: true};
  if (typeof fuzzParams.timeout == "undefined") {
    fuzzParams.timeout = 60000;
    await setMinDriverTimeout(driver, fuzzParams.timeout);
  }

  await startTestRun(driver, "functional", fuzzParams, incognito);
  let handle = await getHandle(driver, "/functional.html");
  let results = await pollMessages(driver, handle, isMV3);
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function suspendServiceWorker(driver, handle) {
  let browser = (await driver.getCapabilities()).getBrowserName();
  if (browser != "chrome" && browser != "msedge")
    throw new Error("Suspending service workers is not implemented for non Chromium-based browsers because we don't support MV3 in them");

  await driver.switchTo().newWindow("tab");
  await driver.get("chrome://serviceworker-internals/");
  let stopButtons = await driver.findElements(webdriver.By.className("stop"));
  for (let stopButton of stopButtons) {
    if (await stopButton.isDisplayed())
      await stopButton.click();
  }
  // Short delay to ensure that there is time for the browser to get
  // the click event and start suspending the service worker before we
  // kill the page.
  await new Promise(r => setTimeout(r, 10));
  await driver.close();
  await driver.switchTo().window(handle);
}

async function run() {
  let {manifest, browser, version, params, testKinds} = parseArguments();
  let isMV3 = manifestIsMV3(manifest);

  let extensionPaths =
    [path.resolve(process.cwd(), "dist", `test-m${manifest}`)];
  let incognito =
    typeof params != "undefined" && typeof params.incognito != "undefined";
  let headless = browser == "firefox" && !incognito;
  let extraArgs = [];
  // auto-open-devtools-for-tabs is required to make MV3 service
  // workers start up after being suspended in tests.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=1325792#c8
  if (isMV3 && (browser == "chromium" || browser == "edge"))
    extraArgs.push("auto-open-devtools-for-tabs");

  console.log(`Getting ready to run ${browser}...`);
  let driver = await BROWSERS[browser].getDriver(
    version, {headless, extensionPaths, incognito, extraArgs});

  if (params && typeof params.timeout != "undefined")
    await setMinDriverTimeout(driver, params.timeout);

  let results = {};

  try {
    let cap = await driver.getCapabilities();
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);
    if (incognito) {
      await BROWSERS[browser].enableExtensionInIncognito(
        driver, "eyeo's Web Extension Ad Blocking Toolkit Test Extension");
    }

    for (let testKind of testKinds) {
      switch (testKind) {
        case "functional":
          results.functional = await runFunctionalTests(
            driver, params, isMV3, incognito
          );
          break;
        case "reload":
          results.reload = await runReloadTests(driver, params, isMV3);
          break;
        case "fuzz":
          results.fuzz = await runFuzzTests(driver, params, isMV3, incognito);
          break;
        default:
          console.warn(`Unknown test kind: ${testKind}`);
      }
    }
  }
  finally {
    await driver.quit();
  }

  let totalTestsRun = 0;
  let expectTestsForEveryKind = !(params && params.grep);
  for (let testKind of testKinds) {
    if (!results[testKind]) {
      console.error(`Test Failure: ${testKind} tests did not run correctly`);
      process.exit(1);
    }

    if (expectTestsForEveryKind && results[testKind].total == 0) {
      console.error(`Test Failure: No ${testKind} tests ran`);
      process.exit(1);
    }

    if (results[testKind].failures > 0) {
      console.error(`Test Failure: ${results[testKind].failures} ${testKind} tests failed`);
      process.exit(1);
    }

    totalTestsRun += results[testKind].total;
  }

  if (totalTestsRun == 0) {
    console.error("Test Failure: No tests ran");
    process.exit(1);
  }

  console.log("All tests passed");
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
