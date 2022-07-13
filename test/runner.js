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
  parser.option("grep");

  let {argv} = parser;
  let params;
  for (let param of ["timeout", "grep", "incognito"]) {
    let value = argv[param];
    if (typeof value != "undefined")
      (params || (params = {}))[param] = value;
  }
  return {
    manifest: argv.manifest,
    browser: argv.browser,
    version: argv.version,
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

async function getHandle(driver, page) {
  let url;
  let handle = await driver.wait(() => switchToHandle(driver, handleUrl => {
    if (!handleUrl)
      return false;

    url = new URL(handleUrl);
    return url.pathname == page;
  }), 8000, `${page} did not open`);

  return handle;
}

function manifestIsMV3(manifest) {
  return manifest.startsWith("v3");
}

async function pollMessages(browser, driver, handle, manifest) {
  let isMV3 = manifestIsMV3(manifest);
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

async function startTestRun(driver, id, params) {
  let search = new URLSearchParams();
  for (let key in params)
    search.append(key, params[key]);

  await getHandle(driver, "/index.html");
  if (search.toString()) {
    let url = await driver.getCurrentUrl();
    url = `${url}?${search.toString()}`;
    await driver.navigate().to(url);
  }

  await driver.findElement(webdriver.By.id(id)).click();
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
  // This is a very long timeout, to ensure that the service worker
  // has time to finish shutting down even on slow single core
  // service workers before we start trying to wake it up again.
  await new Promise(r => setTimeout(r, 1000));
  await driver.close();
  await driver.switchTo().window(handle);
}

async function run() {
  let {manifest, browser, version, params} = parseArguments();
  let extensionPaths =
    [path.resolve(process.cwd(), "dist", `test-m${manifest}`)];
  let incognito =
    typeof params != "undefined" && typeof params.incognito != "undefined";
  let headless = browser == "firefox" && !incognito;
  let extraArgs = [];
  // auto-open-devtools-for-tabs is required to make MV3 service
  // workers start up after being suspended in tests.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=1325792#c8
  if (manifestIsMV3(manifest) && (browser == "chromium" || browser == "edge"))
    extraArgs.push("auto-open-devtools-for-tabs");

  console.log(`Getting ready to run ${browser}...`);
  let driver = await BROWSERS[browser].getDriver(
    version, {headless, extensionPaths, incognito, extraArgs});

  if (params && typeof params.timeout != "undefined") {
    let driverTimeouts = await driver.manage().getTimeouts();
    let paramsTimeout = parseInt(params.timeout, 10);
    if (paramsTimeout == 0) {
      // 0 is a mocha special case to disable timeouts
      await driver.manage().setTimeouts({
        script: null
      });
    }
    else if (paramsTimeout > driverTimeouts.script) {
      await driver.manage().setTimeouts({
        script: paramsTimeout
      });
    }
  }

  let results = {
    functional: null,
    reload: null
  };

  try {
    let cap = await driver.getCapabilities();
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);
    if (incognito) {
      await BROWSERS[browser].enableExtensionInIncognito(
        driver, "eyeo's Web Extension Ad Blocking Toolkit Test Extension");
    }

    await startTestRun(driver, "functional", params);
    let handle = await getHandle(driver, "/functional.html");
    results.functional = await pollMessages(browser, driver, handle, manifest);

    await startTestRun(driver, "reload");
    while (!results.reload ||
           results.reload.log.toString().includes("Reload (preparation)")) {
      handle = await getHandle(driver, "/reload.html");
      try {
        results.reload = await pollMessages(browser, driver, handle, manifest);
      }
      catch (e) {
        if (e.name != "NoSuchWindowError")
          throw e;
      }
    }
  }
  finally {
    await driver.quit();
  }

  let totalTestsRun = 0;
  let expectTestsInEverySection = !(params && params.grep);
  for (let section in results) {
    if (!results[section]) {
      console.error(`Test Failure: ${section} tests did not run correctly`);
      process.exit(1);
    }

    if (expectTestsInEverySection && results[section].total == 0) {
      console.error(`Test Failure: No ${section} tests ran`);
      process.exit(1);
    }

    if (results[section].failures > 0) {
      console.error(`Test Failure: ${results[section].failures} ${section} tests failed`);
      process.exit(1);
    }

    totalTestsRun += results[section].total;
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
