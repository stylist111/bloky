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
import fs from "fs";

import yargs from "yargs";
import webdriver from "selenium-webdriver";
import {BROWSERS, getMajorVersion} from "@eyeo/get-browser-binary";

import {isMain} from "../../scripts/utils.js";
import {getHandle, switchToHandle, getDriver} from "./utils.js";
import {runTestServer, killTestServer} from "../../scripts/test-server-manager.js";

const isScriptInvokedFromCLI = isMain(import.meta.url);

let originalExtensionPath;
let currentExtensionPath;
let extensionPaths;

function parseArguments() {
  try {
    let parser = yargs(process.argv.slice(2)).exitProcess(false);
    parser.version(false);
    parser.strict();
    parser.command("$0 <manifest> <browser> [version]", "", subparser => {
      subparser.positional("manifest", {choices: [2, 3]});
      subparser.positional("browser", {choices: Object.keys(BROWSERS)});
      subparser.positional("version", {type: "string", default: "latest"});
    });
    parser.option("incognito", {
      description: "Run the tests in incognito mode (Chrome) or private browsing (Firefox)."
    });
    parser.option("forceHeadful", {
      description: "Run the tests in non headless mode."
    });
    parser.option("timeout", {
      description: "Maximum running time for each test. 0 disables timeouts."
    });
    parser.option("testKinds", {
      description: "Kinds of tests to run. On MV2, defaults to functional, reload and update tests. On MV3, defaults to all tests.",
      array: true,
      choices: ["functional", "reload", "update", "mv2-mv3-migrate", "fuzz"]
    });
    parser.option("browserBinary", {
      description: "Custom Browser Binary Path."
    });
    parser.option("grep"), {
      array: true
    };
    parser.option("verbose", {
      alias: "v",
      type: "boolean",
      requiresArg: false,
      description: "Verbose console logging, including admin test server requests"
    });

    let {argv} = parser;
    let params;
    for (let param of ["timeout", "grep", "incognito", "forceHeadful", "browserBinary", "verbose"]) {
      let value = argv[param];
      if (typeof value != "undefined") {
        (params || (params = {}))[param] = value;
      }
    }
    // we need to build regexp to allow to pas multiple grep flags
    // and do && on them
    if (params && params.grep) {
      params.grep = regexpFromGrep(params.grep);
    }
    let testKinds = argv.testKinds;
    // default is specified here rather than using a yargs default
    // because it depends on another yargs option (the manifest).
    if (!testKinds) {
      testKinds = ["functional", "reload", "update"];
      if (manifestIsMV3(argv.manifest)) {
        testKinds.push("fuzz");
      }
      else if (argv.browser === "chromium" || argv.browser === "edge") {
        let version = argv.version;
        // Chromium 124 is the minimum supported version for MV3.
        if (version === "latest" || version === "dev" || version === "beta" ||
            version.split(".")[0] >= 124) {
          testKinds.push("mv2-mv3-migrate");
        }
      }
    }
    // Chromium 128 is the latest supported version for MV2
    if (argv.browser === "chromium" &&
        argv.manifest === 2 &&
        argv.version === "latest") {
      console.warn("Warning: using Chromium 128 as the latest supported version for MV2");
      argv.version = "128.0.6613.0";
    }
    return {
      manifest: argv.manifest,
      browser: argv.browser,
      version: argv.version,
      testKinds,
      params
    };
  }
  catch (error) {
    throw new Error(error.message);
  }
}

function regexpFromGrep(grep) {
  let grepped = Array.isArray(grep) ? grep : [grep];

  // we need to check if we should exclude or include elements
  let greppedString;
  for (let element of grepped) {
    // exclude
    if (element.startsWith("!")) {
      greppedString = greppedString ? greppedString + "(?!.*" + element.slice(1) + ")" : "^(?!.*" + element.slice(1) + ")";
    }
    // include
    else {
      greppedString = greppedString ? greppedString + "(?=.*" + element + ")" : "(?=.*" + element + ")";
    }
  }
  return new RegExp(greppedString);
}

function manifestIsMV3(manifest) {
  return manifest === 3;
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

async function updateManifest(version) {
  for (let extensionPath of extensionPaths) {
    let manifestFile = path.resolve(extensionPath, "manifest.json");
    let content = JSON.parse(await fs.promises.readFile(manifestFile));
    content.version = version;
    await fs.promises.writeFile(manifestFile, JSON.stringify(content, null, 2));
  }
}

export async function exists(filename) {
  try {
    await fs.promises.access(filename);
    return true;
  }
  catch (error) {
    return false;
  }
}

async function copyFile(fromFile, toFile) {
  for (let extensionPath of extensionPaths) {
    let absFromFile = path.resolve(extensionPath, fromFile);
    let absToFile = path.resolve(extensionPath, toFile);
    if (await exists(absFromFile)) {
      let content = (await fs.promises.readFile(absFromFile)).toString();
      if (await exists(absToFile)) {
        await fs.promises.unlink(absToFile);
      }
      await fs.promises.writeFile(absToFile, content);
    }
  }
}

async function moveFile(fromFile, toFile) {
  for (let extensionPath of extensionPaths) {
    let absFromFile = path.resolve(extensionPath, fromFile);
    let absToFile = path.resolve(extensionPath, toFile);
    if (await exists(absFromFile)) {
      if (await exists(absToFile)) {
        await fs.promises.unlink(absToFile);
      }
      await fs.promises.rename(absFromFile, absToFile);
    }
  }
}

async function addLines(file, lines) {
  for (let extensionPath of extensionPaths) {
    let absFile = path.resolve(extensionPath, file);
    if (await exists(absFile)) {
      let content = (await fs.promises.readFile(absFile)).toString();
      for (let line of lines) {
        content = content + "\n" + line;
      }
      await fs.promises.writeFile(absFile, content);
    }
  }
}

async function removeLines(file, lines) {
  for (let extensionPath of extensionPaths) {
    let absFile = path.resolve(extensionPath, file);
    if (await exists(absFile)) {
      let content = (await fs.promises.readFile(absFile)).toString().split("\n");
      let readyContent = [];
      for (let line of content) {
        if (lines.indexOf(line) < 0) {
          readyContent.push(line);
        }
      }
      await fs.promises.writeFile(absFile, readyContent.join("\n"));
    }
  }
}

async function findAndReplaceInFile(file, findRegex, replace) {
  for (let extensionPath of extensionPaths) {
    const fileToUpdate = path.resolve(extensionPath, file);
    let content = (await fs.promises.readFile(fileToUpdate)).toString();
    content = content.replace(new RegExp(findRegex, "gs"), replace);

    await fs.promises.writeFile(fileToUpdate, content);
  }
}

async function copyDir(fromDir, toDir) {
  if (await exists(toDir)) {
    await fs.promises.rm(toDir, {recursive: true});
  }
  await fs.promises.cp(fromDir, toDir, {recursive: true});
}

async function runCommand(method, args) {
  switch (method) {
    case "copyFile":
      await copyFile(args.from, args.to);
      break;

    case "moveFile":
      await moveFile(args.from, args.to);
      break;

    case "addLines":
      await addLines(args.file, args.lines);
      break;

    case "findAndReplaceInFile":
      await findAndReplaceInFile(args.file, args.findRegex, args.replace);
      break;

    case "removeLines":
      await removeLines(args.file, args.lines);
      break;

    case "copyDir":
      let absFrom = path.resolve(process.cwd(), "dist", args.from);
      let absTo = args.to ?
        path.resolve(process.cwd(), "dist", args.to) :
        currentExtensionPath;
      await copyDir(absFrom, absTo);
      break;

    case "updateManifest":
      await updateManifest(args.version);
      break;

    default:
      throw new Error(`Unknown command: ${method}`);
  }
}

async function updateWebExtension(commands) {
  for (let command of commands) {
    await runCommand(command.method, command.args);
  }
}

async function pollMessages(driver, handle, isMV3) {
  let result;
  let webdriverEvents = [];
  let log = [];

  while (!result) {
    let script = `
      let webdriverEvents = arguments[0];
      return new Promise(resolve => {
        if (document.readyState == "complete")
          resolve(poll(webdriverEvents));
        else
          window.addEventListener("load", () => resolve(poll(webdriverEvents)));
      });`;
    let messages = await runWithRetry(
      () => driver.executeScript(script, webdriverEvents)
    );
    webdriverEvents = [];

    if (!messages) {
      return;
    }

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

        case "updateExtensionFiles":
          await updateWebExtension(JSON.parse(arg));
          webdriverEvents.push({id: "extensionUpdated"});
          break;

        case "suspendServiceWorker":
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
  for (let key in params) {
    search.append(key, params[key]);
  }

  search = search.toString();

  // starting the extension can sometimes be really slow. This is
  // worst in incognito mode and when an MV3 extension has many
  // subscriptions and rulesets.
  await getHandle(driver, "/index.html", 25000);
  if (search) {
    let url = await driver.getCurrentUrl();
    let urlComponents = url.split("?");
    let currentPath = urlComponents[0];
    let currentSearch = urlComponents[1];
    if (!currentSearch || currentSearch != search) {
      await driver.navigate().to(`${currentPath}?${search}`);
    }
  }

  await driver.findElement(webdriver.By.id(id)).click();
}

async function runFunctionalTests(driver, params, isMV3) {
  console.log("================");
  console.log("Functional Tests");
  console.log("================");

  await startTestRun(driver, "functional", params);
  let handle = await getHandle(driver, "/functional.html");
  let results = await pollMessages(driver, handle, isMV3);
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function runReloadTests(
  driver, params, isMV3, title, id, testOutputToken, page) {
  console.log("============");
  console.log(`${title} Tests`);
  console.log("============");

  let results;
  let handle;

  await startTestRun(driver, id, params);
  while (!results ||
         results.log.toString().includes(`${testOutputToken} (preparation)`)) {
    // Reloading with an update has the same performance impact as
    // loading the first time. This is worst in incognito mode and
    // when an MV3 extension has many subscriptions and rulesets, and on the
    // lastest Edge on Windows
    handle = await getHandle(driver, page, 100000);
    try {
      results = await pollMessages(driver, handle, isMV3);
    }
    catch (e) {
      if (e.name != "NoSuchWindowError") {
        throw e;
      }
    }
  }
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function runFuzzTests(driver, params, isMV3) {
  console.log("==========");
  console.log("Fuzz Tests");
  console.log("==========");

  if (!isMV3) {
    console.warn("Service worker fuzzing tests are only for MV3");
    return {failures: 0, totalPending: 0, total: 0, log: []};
  }

  let fuzzParams = {...params, fuzzServiceWorkers: true};
  if (typeof fuzzParams.timeout == "undefined") {
    fuzzParams.timeout = 240000;
    await setMinDriverTimeout(driver, fuzzParams.timeout);
  }

  await startTestRun(driver, "functional", fuzzParams);
  let handle = await getHandle(driver, "/functional.html");
  let results = await pollMessages(driver, handle, isMV3);
  await driver.switchTo().window(handle);
  await driver.close();
  return results;
}

async function runWithRetry(fn, retryCount = 2) {
  try {
    return await fn();
  }
  catch (err) {
    // In low resource machines we sometimes get these errors when
    // interacting with the browser. Retrying usually helps.
    let docUnloaded = "Document was unloaded";
    let inspectorDetatched = "received Inspector.detached event";
    let targetIdNotFound = "No target with given id found";

    let message = err.message;
    let isLowResourceError = message.includes(docUnloaded) ||
        message.includes(inspectorDetatched) ||
        message.includes(targetIdNotFound);

    if (retryCount > 0 && isLowResourceError) {
      return await runWithRetry(fn, retryCount - 1);
    }
    throw err;
  }
}

async function suspendServiceWorker(driver, handle) {
  let browser = (await driver.getCapabilities()).getBrowserName();
  if (browser != "chrome" && browser != "msedge" && browser != "MicrosoftEdge") {
    throw new Error("Suspending service workers is not implemented for non Chromium-based browsers because we don't support MV3 in them");
  }

  return await runWithRetry(
    async() => {
      await driver.switchTo().newWindow("tab");
      await driver.get("chrome://serviceworker-internals/");
      let stopButtons = await driver.findElements(webdriver.By.className("stop"));

      if (stopButtons.length == 0) {
        throw new Error("No service workers to stop.");
      }

      for (let stopButton of stopButtons) {
        if (await stopButton.isDisplayed()) {
          await stopButton.click();
        }
      }
      // Short delay to ensure that there is time for the browser to get
      // the click event and start suspending the service worker before we
      // kill the page.
      await new Promise(r => setTimeout(r, 10));
      await driver.close();
      await driver.switchTo().window(handle);
    }
  );
}

export async function run() {
  const args = parseArguments();
  try {
    if (isScriptInvokedFromCLI) {
      await runTestServer(args.params ? args.params.verbose : false);
    }

    await runTests(args);
  }
  finally {
    if (isScriptInvokedFromCLI) {
      await killTestServer();
    }
  }
}

async function runTests({manifest, browser, version, params, testKinds}) {
  let isMV3 = manifestIsMV3(manifest);
  // copy a targeted test web extension to a temporary directory `test-current`
  originalExtensionPath = path.resolve(process.cwd(), "dist", `test-mv${manifest}`);
  if (testKinds.includes("mv2-mv3-migrate") || testKinds.includes("update")) {
    currentExtensionPath = path.resolve(process.cwd(), "dist", "test-current");
    await copyDir(originalExtensionPath, currentExtensionPath);
  }
  else {
    currentExtensionPath = originalExtensionPath;
  }
  extensionPaths = [currentExtensionPath];

  let incognito =
    typeof params != "undefined" && typeof params.incognito != "undefined";
  let forceHeadful = typeof params != "undefined" && typeof params.forceHeadful != "undefined";

  let customBrowserBinary = null;
  if (typeof params != "undefined" && typeof params.browserBinary != "undefined") {
    customBrowserBinary = params.browserBinary;
  }

  console.log(`Getting ready to run ${browser} ${version} ...`);

  let versionNumber = version;
  let majorVersion;
  if (customBrowserBinary) {
    const installedVersion =
      await BROWSERS[browser].getInstalledVersion(customBrowserBinary);
    // versionNumber parsing should not be needed after this issue is fixed
    // https://gitlab.com/eyeo/developer-experience/get-browser-binary/-/issues/81
    versionNumber = installedVersion.split(" ")[1] || installedVersion;
    console.log(`Found ${browser} ${versionNumber} ...`);
    majorVersion = getMajorVersion(versionNumber);
  }
  // On Windows, Edge is assumed to be already installed
  else if (browser != "edge" || process.platform != "win32") {
    ({versionNumber} = await BROWSERS[browser].installBrowser(version));
    console.log(`Installed ${browser} ${versionNumber} ...`);
    majorVersion = getMajorVersion(versionNumber);
  }

  let extraArgs = [];
  // auto-open-devtools-for-tabs is required to make MV3 service
  // workers start up after being suspended in tests.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=1325792#c8
  // This was fixed in Chromium 116.
  if ((isMV3 || testKinds.includes("mv2-mv3-migrate")) &&
      (browser == "chromium" || browser == "edge") && majorVersion < 116) {
    extraArgs.push("auto-open-devtools-for-tabs");
  }

  // New headless mode was introduced in Chromium 111 and Edge 114. The old
  // headless mode does not support loading extensions.
  let isFirefox = browser == "firefox";
  let isChromium = browser == "chromium";
  let isChromiumWithNewHeadlessMode = isChromium && majorVersion >= 111;
  let isEdge = browser == "edge";
  let isEdgeWithNewHeadlessMode = isEdge && majorVersion >= 114;
  let headless = !incognito && !forceHeadful &&
    (isFirefox || isChromiumWithNewHeadlessMode || isEdgeWithNewHeadlessMode);

  let insecure = false;
  if (isChromium || isEdge) {
    // DNS mapping (supported by Chromium-based only browsers)
    extraArgs.push("host-resolver-rules=" + [
      "webext.com",
      "sub.webext.com",
      "search.webext.com",
      "webext.co.uk",
      "expedia.com",
      "hotels.com"
    ].map(domain => `MAP ${domain} 127.0.0.1`).join(", "));

    // allow HTTP
    insecure = true;
  }

  let results = {};
  let driver;
  const options = {headless, extensionPaths, incognito, insecure, extraArgs,
                   customBrowserBinary};
  try {
    driver = await getDriver(browser, version, options);

    let driverTimeout = 200000;
    if (params && typeof params.timeout != "undefined" &&
        params.timeout > driverTimeout) {
      driverTimeout = params.timeout;
    }
    await setMinDriverTimeout(driver, driverTimeout);

    if (incognito) {
      await BROWSERS[browser].enableExtensionInIncognito(
        driver, "eyeo's WebExtension Ad-Filtering Solution Test Extension");
    }

    for (let testKind of testKinds) {
      switch (testKind) {
        case "functional":
          results.functional = await runFunctionalTests(
            driver, params, isMV3);
          break;
        case "reload":
          results.reload = await runReloadTests(
            driver, params, isMV3, "Reload", "reload", "Reload", "/reload.html");
          break;
        case "update":
          results.update = await runReloadTests(
            driver, params, isMV3, "Update", "update", "Update", "/update.html");
          break;
        case "mv2-mv3-migrate":
          if (isMV3) {
            console.warn("Migrate tests assume it's started as MV2 test and continued as MV3 test");
          }
          results["mv2-mv3-migrate"] = await runReloadTests(
            driver, params, isMV3,
            "MV2 MV3 migrate", "mv2-mv3-migrate", "MV2 MV3 migrate", "/mv2-mv3-migrate.html");
          break;
        case "fuzz":
          results.fuzz = await runFuzzTests(driver, params, isMV3);
          break;
        default:
          console.warn(`Unknown test kind: ${testKind}`);
      }
    }
  }
  finally {
    if (driver) {
      await driver.quit();
    }
  }

  let totalTestsRun = 0;
  let totalTestsSkipped = 0;
  let expectTestsForEveryKind = !(params && params.grep);

  function isTestKindSkippable(testKind) {
    const mv2SkippableTestKinds = ["mv2-mv3-migrate"];
    const mv3SkippableTestKinds = [];
    // eslint-disable-next-line max-len
    const skippableTestKinds = isMV3 ? mv3SkippableTestKinds : mv2SkippableTestKinds;
    return skippableTestKinds.includes(testKind);
  }

  for (let testKind of testKinds) {
    if (!results[testKind]) {
      throw new Error(`Test Failure: ${testKind} tests did not run correctly`);
    }

    // eslint-disable-next-line max-len
    const wereTestsSkipped = results[testKind].skipped === results[testKind].total && !isTestKindSkippable(testKind);
    const didTestsRun = results[testKind].total > 0 && !wereTestsSkipped;

    if (expectTestsForEveryKind && !didTestsRun) {
      throw new Error(`Test Failure: No ${testKind} tests ran`);
    }

    if (results[testKind].failures > 0) {
      throw new Error(`Test Failure: ${results[testKind].failures} ${testKind} tests failed`);
    }

    totalTestsRun += results[testKind].total;
    totalTestsSkipped += results[testKind].skipped;
  }

  if (totalTestsRun === 0 || totalTestsRun === totalTestsSkipped) {
    throw new Error("Test Failure: No tests ran");
  }

  console.log("All tests passed");
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err instanceof Error ? err.stack : `Error: ${err}`);
    killTestServer();
    process.exit(1);
  });
}
