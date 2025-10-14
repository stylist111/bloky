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

import path from "path";

import { BROWSERS, getMajorVersion } from "@eyeo/get-browser-binary";
import {
  startMockServer,
  stopMockServer,
  addMocksForTestPages,
  addMocksForWebsitePages,
} from "../test-server/mock-http-server/index.js";
import { findUrl, openNewTab, getAllWindowHandlesSafe, screenshot } from "./driver.js";
import {
  getOptionsHandle,
  setOptionsHandle,
  extractExtension,
  getExtensionInfo,
} from "./extension.js";

let smokeTestsFailed;

/**
 * Hook to set the E2E tests global options
 *
 * @param {Object} runnerConfig - Options passed to the runE2ETests function
 */
export function setGlobalOptionsHook(runnerConfig) {
  global.config = runnerConfig;
}

/**
 * Starts the browser with the extension installed
 *
 * @param {string} extensionPath - The path to the extension to install
 * @param {number} retry - The number of times to retry starting the browser
 * @returns {Promise<(*|string|string|(function(): *)|number)[]>}
 */
async function startBrowser(extensionPath, retry = 0) {
  const { helperExtensionPath, browserName, browserVersion } = global.config;
  const version = browserVersion || "latest";

  const browser = BROWSERS[browserName];
  if (!browser) {
    throw new Error(
      `Unsupported browser "${browserName}". Supported browsers: ${Object.keys(BROWSERS)}`,
    );
  }

  try {
    const { versionNumber } = await browser.installBrowser(version);
    console.log(`Installed ${browserName} ${versionNumber} ...`);

    const extensionPaths = [helperExtensionPath, extensionPath];
    const headless = process.env.FORCE_HEADFUL !== "true";

    let options;
    let extraArgs;
    if (browserName === "firefox") {
      extraArgs = ["-width=1400", "-height=1500"];
      // EXT-497: we need to bind "testpages.eyeo.com" to "localhost"
      // to be able to test with locally hosted page. For FF we use PAC file
      // to set proxy
      const proxy = "http://localhost:3005/proxy-config.pac";
      options = {
        headless,
        extensionPaths,
        extraArgs,
        proxy,
        insecure: true,
      };
    } else {
      extraArgs = [
        "--window-size=1400,1500",
        "--proxy-server=http://localhost:9999", // mock http server
        "--ignore-certificate-errors",
        "--disable-search-engine-choice-screen",
      ];
      options = { headless, extensionPaths, extraArgs };
    }

    const driver = await BROWSERS[browserName].getDriver(version, options);

    const cap = await driver.getCapabilities();
    const browserVersion = cap.getBrowserVersion();
    console.log(`Browser: ${cap.getBrowserName()} ${browserVersion}`);

    return [driver, browserName, browserVersion, getMajorVersion(browserVersion)];
  } catch (err) {
    if (retry < 5) {
      console.warn(`Failed to start the browser: ${err.message}, retrying (${retry})...`);
      await new Promise((r) => setTimeout(r, 1000));
      return startBrowser(extensionPath, retry + 1);
    }

    throw err;
  }
}

/**
 * Hook to set up the browser before the tests
 *
 * @param {string} buildsDirPath - The path to the directory containing the extension builds
 * @param {string} unpackedDirPath - The path to the directory to extract the extension to
 * @returns {Promise<void>}
 */
export async function setupBrowserHook(buildsDirPath, unpackedDirPath) {
  let extensionPath;
  // buildsDirPath is not used when running Fragments tests
  if (buildsDirPath) {
    extensionPath = await extractExtension(buildsDirPath, unpackedDirPath);
  } else {
    const { manifestVersion } = global.config;
    if (manifestVersion === "3") {
      extensionPath = path.join(unpackedDirPath, "mv3");
    } else {
      extensionPath = path.join(unpackedDirPath, "mv2");
    }
  }

  const mockServer = await startMockServer();
  // EXT-497: we need to bind "testpages.eyeo.com" to "localhost"
  // to be able to test with locally hosted page.
  await addMocksForTestPages();
  // we mock some pages from the website to avoid polluting our analytics
  await addMocksForWebsitePages();

  const [driver, browserName, fullBrowserVersion, majorBrowserVersion] =
    await startBrowser(extensionPath);

  // Set global variables for the tests
  global.driver = driver;
  global.mockServer = mockServer;

  global.browserDetails = {
    browserName,
    fullBrowserVersion,
    majorBrowserVersion,
  };
}

/**
 * Hook to set up the browser before the tests
 *
 * @returns {Promise<void>}
 */
export async function prepareExtensionHook() {
  const { handle } = await findUrl("options.html", { timeout: 15000 });
  setOptionsHandle(handle);

  const { name, version, manifestVersion, origin, popupUrl } = await getExtensionInfo();
  // the name of the extension from the Flattr payload is the extension name in lowercase without spaces
  const flattrName = name.toLowerCase().replace(" ", "");
  console.log(`Extension: ${name} ${version} MV${manifestVersion}`);

  // Set global variables for the tests
  global.extension = {
    name,
    flattrName,
    manifestVersion,
    origin,
    version,
    popupUrl,
  };
}

/**
 * Hook to set a variable smokeTestsFailed to true if a smoke test failed
 * Should only be used inside the Smoke test suite
 */
export function setSmokeTestsFailed() {
  if (this.currentTest.state === "failed") {
    smokeTestsFailed = true;
  }
}

/**
 * Hook to skip test suites if variable smokeTestsFailed is true
 */
export function skipWhenSmokeTestsFailed() {
  if (smokeTestsFailed) {
    console.warn("Skipping subsequent tests due to failure in one or more Smoke tests");
    this.skip();
  }
}

/**
 * Hook to take a screenshot after each test if the test failed
 *
 * @returns {Promise<void>}
 */
export async function screenshotsHook() {
  const { currentTest } = this;
  const currentHook = currentTest.ctx.test;

  if (currentTest.state !== "failed" && currentHook.state !== "failed") {
    return;
  }

  let title = currentTest.state === "failed" ? currentTest.title : currentHook.title;
  title = title.replaceAll(" ", "_").replaceAll('"', "");
  await driver.switchTo().defaultContent();
  await screenshot(title);
}

/**
 * Hook to clean up after the tests
 *
 * @returns {Promise<void>}
 */
export async function cleanupHook() {
  await stopMockServer();
  if (global.driver) {
    await driver.quit();
    delete global.driver;
  }
}

export async function cleanupOpenTabs() {
  const { installUrl } = global.config;

  for (const handle of await getAllWindowHandlesSafe()) {
    try {
      await driver.switchTo().window(handle);
      const url = await driver.getCurrentUrl();

      if (handle !== getOptionsHandle() && !url.includes(installUrl) && !url.includes("data:")) {
        await driver.close();
      }
    } catch (err) {
      if (err.name !== "NoSuchWindowError") throw err;

      // If the tab no longer exists there's nothing to be closed
      continue;
    }
  }
}

export async function beforeEachTasks() {
  // If the options page handle is not valid anymore, then restore it
  try {
    await driver.switchTo().window(getOptionsHandle());
  } catch (e) {
    await openNewTab(`${extension.origin}/options.html`);
    setOptionsHandle(await driver.getWindowHandle());
  }

  await cleanupOpenTabs();
  await driver.switchTo().window(getOptionsHandle());
}
