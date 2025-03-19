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

import { BROWSERS, getMajorVersion } from "@eyeo/get-browser-binary";

import { findUrl, openNewTab, screenshot } from "./driver.js";
import {
  getOptionsHandle,
  setOptionsHandle,
  extractExtension,
  getExtensionInfo,
} from "./extension.js";

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
  const version = "latest";
  const { helperExtensionPath, browserName } = global.config;

  try {
    const { versionNumber } = await BROWSERS[browserName].installBrowser(version);
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
      options = { headless, extensionPaths, extraArgs, proxy };
    } else {
      extraArgs = [
        "--window-size=1400,1500",
        // EXT-497: we need to bind "testpages.eyeo.com" to "localhost"
        // to be able to test with locally hosted page.
        "--host-resolver-rules=MAP testpages.eyeo.com 127.0.0.1",
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
  } catch (e) {
    if (retry < 5) {
      console.warn(`Failed to start the browser, retrying (${retry})...`);
      await new Promise((r) => setTimeout(r, 1000));
      return startBrowser(extensionPath, retry + 1);
    }

    throw e;
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
  const extensionPath = await extractExtension(buildsDirPath, unpackedDirPath);

  const [driver, browserName, fullBrowserVersion, majorBrowserVersion] =
    await startBrowser(extensionPath);

  // Set global variables for the tests
  global.driver = driver;

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
  const { handle } = await findUrl("options.html", 15000);
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
 * Hook to take a screenshot after each test if the test failed
 *
 * @returns {Promise<void>}
 */
export async function screenshotsHook() {
  if (this.currentTest.state !== "failed") {
    return;
  }

  const title = this.currentTest.title.replaceAll(" ", "_");
  await screenshot(title);
}

/**
 * Hook to clean up after the tests
 *
 * @returns {Promise<void>}
 */
export async function cleanupHook() {
  if (driver) {
    await driver.quit();
  }
}

async function cleanupOpenTabs() {
  const { installUrl } = global.config;

  for (const handle of await driver.getAllWindowHandles()) {
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
