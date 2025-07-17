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

import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { By } from "selenium-webdriver";
import { expect } from "expect";

import { openNewTab, getTabId, getFromStorage, wait } from "./driver.js";
import { localTestPageUrl, blockHideLocalhostUrl } from "../test-server/urls.js";

export const subscriptionUrl = "https://abptestpages.org/en/abp-testcase-subscription.txt";
export const ytAllowlistUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

let optionsHandle;

/**
 * Sets the Options page handle
 *
 * @param {string} handle - Selenium window handle pointing to the Options page tab
 */
export function setOptionsHandle(handle) {
  optionsHandle = handle;
}

/**
 * Gets the Selenium window handle pointing to the Options page tab
 *
 * @returns {string}
 */
export function getOptionsHandle() {
  return optionsHandle;
}

/**
 * Extracts the extension from the release folder based on the browser name
 *
 * @param {string} buildsDirPath - The path to the directory containing the extension builds
 * @param {string} unpackedDirPath - The path to the directory to extract the extension to
 * @returns {Promise<string>}
 */
export async function extractExtension(buildsDirPath, unpackedDirPath) {
  const files = await fs.promises.readdir(buildsDirPath);
  const { browserName, manifestVersion, hostname } = global.config;

  let buildRegex;
  if (manifestVersion === "3") {
    buildRegex = new RegExp(`${hostname}-chrome-.*-mv3.zip`);
  } else if (browserName === "edge") {
    buildRegex = new RegExp(`${hostname}-chrome-.*-mv2.zip`);
  } else {
    buildRegex = new RegExp(`${hostname}-firefox-.*-mv2.xpi`);
  }
  const [releaseFile] = files.filter((f) => buildRegex.test(f));

  if (!releaseFile) {
    throw new Error(`${buildRegex} was not found in ${buildsDirPath}`);
  }

  await fs.promises.rm(unpackedDirPath, { force: true, recursive: true });
  const zip = new AdmZip(path.join(buildsDirPath, releaseFile));
  zip.extractAllTo(unpackedDirPath, true);

  return unpackedDirPath;
}

/**
 * Gets the extension info
 *
 * @returns {Promise<{origin}|awaited !IThenable<T>|*|Promise<*>>}
 */
export async function getExtensionInfo() {
  const info = await driver.executeAsyncScript(async (callback) => {
    if (typeof browser !== "undefined" && browser.management !== "undefined") {
      const { shortName, version, optionsUrl } = await browser.management.getSelf();
      const origin = optionsUrl ? location.origin : null;
      const manifest = await browser.runtime.getManifest();
      const manifestVersion = manifest.manifest_version;
      const popupUrl =
        manifestVersion === 3
          ? await browser.action.getPopup({})
          : await browser.browserAction.getPopup({});
      callback({ name: shortName, version, origin, manifestVersion, popupUrl });
    } else {
      callback({});
    }
  });

  if (!info || !info.origin) {
    throw new Error("Origin was not found");
  } else if (!info.popupUrl) {
    throw new Error("Popup URL was not found");
  }

  return info;
}

/**
 * Changes the extension version in the manifest.json file from "x.x.x[.x]"
 * to "x.x.x.{patch}"
 *
 * @param {string} unpackedDirPath - Path to the unpacked extension folder
 * @param {string} patch - Patch number asigned to the new extension version
 * @returns {Promise<void>}
 */
export async function changeExtensionVersion(unpackedDirPath, patch = "9999") {
  const manifestFile = path.join(unpackedDirPath, "manifest.json");
  const content = JSON.parse(await fs.promises.readFile(manifestFile));

  const [major, minor, hotfix] = content.version.split(".");
  content.version = `${major}.${minor}.${hotfix}.${patch}`;

  await fs.promises.writeFile(manifestFile, JSON.stringify(content, null, 2));
}

/**
 * Sends a message to the extension from the options page.
 *
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @param {object} message - The message to be sent to the extension
 */
export async function sendExtMessage(initOptionsFn, message) {
  const currentHandle = await driver.getWindowHandle();
  const optionsHandle = getOptionsHandle();
  if (currentHandle !== optionsHandle) {
    await initOptionsFn(getOptionsHandle());
  }

  const extResponse = await driver.executeAsyncScript(async (params, callback) => {
    const result = await browser.runtime.sendMessage(params);
    callback(result);
  }, message);

  // go back to prev page
  await driver.switchTo().window(currentHandle);
  return extResponse;
}

/**
 * Changes a setting by sending a message to the extension on the settings page.
 *
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @param {string} name - The setting key name
 * @param {boolean} isEnabled - The settings value
 */
export async function updateSettings(initOptionsFn, name, isEnabled) {
  return sendExtMessage(initOptionsFn, {
    command: "setSetting",
    name,
    isEnabled,
  });
}

/**
 * Changes a pref by sending a message to the extension on the settings page.
 *
 * @param {string} key The pref key name
 * @param {*} value The pref value
 */
export async function updatePrefs(initOptionsFn, key, value) {
  return sendExtMessage(initOptionsFn, {
    type: "prefs.set",
    key,
    value,
  });
}

/**
 * Add filters to the extension
 *
 * @param {string} filters - The filter rules to add
 * @returns {Promise<void>}
 */
export async function addFiltersProgrammatically(initOptionsFn, filtersText) {
  return sendExtMessage(initOptionsFn, {
    type: "filters.importRaw",
    text: filtersText,
  });
}

/**
 * Removes a filter.
 * @param {string} filterText The filter text.
 */
export async function removeFilterProgrammatically(initOptionsFn, filterText) {
  return sendExtMessage(initOptionsFn, {
    type: "filters.remove",
    text: filterText,
  });
}

/**
 * Verifies that the info injected on testUrl matches the actual extension values.
 */
export async function verifyInjectedExtensionData(testUrl, dataAttribute, getActualExtensionData) {
  await openNewTab(testUrl);

  await driver.wait(
    async () => {
      const html = await driver.findElement(By.css("html"));
      const attr = await html.getAttribute(dataAttribute);
      return attr !== null;
    },
    6000,
    `Extension info not injected in <html> on ${testUrl}`,
  );

  const html = await driver.findElement(By.css("html"));
  const injectedAttribute = await html.getAttribute(dataAttribute);
  expect(injectedAttribute).not.toBeNull();

  const parsedHtmlData = JSON.parse(injectedAttribute);
  const actualExtensionData = await getActualExtensionData();

  expect(parsedHtmlData).toMatchObject(actualExtensionData);
}

export function setTimeoutForExtensionReload(mochaContext) {
  // Reloads are slow—ensure longer test timeout
  mochaContext.timeout(60000);
}
/**
 * Reload the extension and wait for the options page to be displayed
 *
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @param {object} [options] - Options object
 * @param {boolean} [options.suppressUpdatePage=true] - Whether to suppress
 *   the update page or not before reloading. Only used by AB
 * @param {boolean} [options.waitForDefaultState=true] - Whether to wait for the
 *   options page default state or not. Only used by ABP
 * @returns {Promise<void>}
 */
export async function reloadExtension(
  initOptionsFn,
  { suppressUpdatePage = true, waitForDefaultState = true } = {},
) {
  // Extension pages will be closed during reload,
  // create a new tab to avoid the "target window already closed" error
  const safeHandle = await openNewTab(localTestPageUrl);

  // Suppress page or not
  await updateSettings(initOptionsFn, "suppress_update_page", suppressUpdatePage);
  await updatePrefs(initOptionsFn, "suppress_first_run_page", suppressUpdatePage);

  // reload the extension
  await initOptionsFn(getOptionsHandle());
  await driver.executeScript(() => {
    // Unloading the extension leads to an ECONNREFUSED error, so in order to
    // ensure that we have enough time to switch to a safe window handle,
    // we're delaying the triggering of the reload
    // https://eyeo.atlassian.net/browse/EXT-153
    setTimeout(() => browser.runtime.reload(), 1000);
  });
  // Workaround for `target window already closed`
  await driver.switchTo().window(safeHandle);

  // Wait until the current option page is closed by the reload
  // otherwise the next step will fail
  await wait(
    async () => {
      const handles = await driver.getAllWindowHandles();
      return !handles.includes(getOptionsHandle());
    },
    5000,
    "Current option page was not closed in time",
  );

  // If the extension on Firefox is not ready by the time we try to open the options page,
  // the navigation will not proceed, and the execution will hang until the default pageLoad
  // timeout is reached, which is 5 minutes by default. We are temporarily changing pageLoad
  // timeout to prevent driver.navigate from hanging
  // https://www.selenium.dev/documentation/webdriver/drivers/options/#page-load-timeout
  const { pageLoad } = await driver.manage().getTimeouts();
  await driver.manage().setTimeouts({ pageLoad: 3000 });

  try {
    // wait for the extension to be ready and the options page to be displayed
    await wait(
      async () => {
        try {
          await driver.navigate().to(`${extension.origin}/options.html`);
          setOptionsHandle(await driver.getWindowHandle());
          // The options parameter is only used by ABP
          await initOptionsFn(getOptionsHandle(), { timeout: 10000, waitForDefaultState });
          return true;
        } catch (e) {
          await driver.navigate().refresh();
        }
      },
      20000,
      "Options page not found after reload, or not in default state",
      1000,
    );
  } finally {
    await driver.manage().setTimeouts({ pageLoad });
  }
}

/**
 * Replaces the extension files with the current build files, and reloads the extension
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @param {object?} reloadOptions - Options passed to reloadExtension call
 * @returns {Promise<void>}
 */
export async function upgradeExtension(initOptionsFn, reloadOptions) {
  const { buildsDirPath, unpackedUpgradeDirPath } = global.config;

  // replace the contents of the extension with the files from the current builds
  await extractExtension(buildsDirPath, unpackedUpgradeDirPath);

  // Change the extension version to check the upgrade mechanism works
  await changeExtensionVersion(unpackedUpgradeDirPath);

  // reload the extension
  await reloadExtension(initOptionsFn, reloadOptions);

  // update the extension info on global
  const { name, version, manifestVersion, origin, popupUrl } = await getExtensionInfo();
  // eslint-disable-next-line no-console
  console.log(`Upgraded extension: ${name} ${version} MV${manifestVersion}`);

  // Reset global extension properties for the tests. Needs to be in sync with `setupBrowserHook`
  global.extension = {
    name,
    manifestVersion,
    origin,
    version,
    popupUrl,
  };
}

/**
 * Uninstalls the extension
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @returns {Promise<void>}
 */
export async function uninstallExtension(initOptionsFn) {
  // Extension pages will be closed during uninstall,
  // create a new tab to avoid the "target window already closed" error
  const safeHandle = await openNewTab(localTestPageUrl);

  await initOptionsFn(getOptionsHandle());

  await driver.executeScript(() => {
    // Unloading the extension leads to an ECONNREFUSED error, so in order to
    // ensure that we have enough time to switch to a safe window handle,
    // we're delaying the triggering of the uninstall
    // https://eyeo.atlassian.net/browse/EXT-153
    setTimeout(() => browser.management.uninstallSelf(), 1000);
  });
  // Workaround for `target window already closed`
  await driver.switchTo().window(safeHandle);

  // Wait until the current option page is closed by the uninstall
  // otherwise the next step will fail
  await wait(
    async () => {
      const handles = await driver.getAllWindowHandles();
      return !handles.includes(getOptionsHandle());
    },
    5000,
    "Current option page was not closed in time",
  );
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getPremiumEmail() {
  const formattedDateYMD = new Date()
    .toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" })
    .replace(/\D/g, "");
  const randomNumber = randomIntFromInterval(1000000, 9999999);

  return `test_automation${formattedDateYMD}${randomNumber}@adblock.org`;
}

// Opens a YT video and triggers auto-allowlisting
export async function autoAllowlistsYoutube() {
  const websiteHandle = await openNewTab(ytAllowlistUrl);
  const tabId = await getTabId(getOptionsHandle());
  await driver.switchTo().window(websiteHandle);

  await driver.executeScript(() => {
    const ytElement = document.createElement("ytd-enforcement-message-view-model");
    document.body.appendChild(ytElement);
  });
  await wait(
    async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "complete";
    },
    2000,
    "Page did not refresh within the expected time",
  );
  return tabId;
}

export async function getEyeometryDataChromium() {
  // 10 seconds is a safe number to assume telemetry is not enabled
  const timeout = 10000;

  return await wait(
    async () => getFromStorage("local", "ewe:telemetry"),
    timeout,
    `No storage data found after ${timeout}ms`,
  );
}

export async function getEyeometryDataFirefox() {
  // 10 seconds is a safe number to assume telemetry is not enabled
  const timeout = 10000;

  try {
    return await wait(async () => getFromStorage("local", "ewe:telemetry"), timeout);
  } catch (err) {
    if (err.name === "TimeoutError") {
      // Timeout exceeded, no telemetry data saved, all good
      return null;
    }
    throw err;
  }
}

// Removes all user filters programmatically
export async function removeAllFilters() {
  return driver.executeAsyncScript(async (callback) => {
    const filters = await browser.runtime.sendMessage({ type: "filters.get" });
    await Promise.all(
      filters.map((filter) =>
        browser.runtime.sendMessage({ type: "filters.remove", text: filter.text }),
      ),
    );

    callback();
  });
}

// Waits for a number to be in range. The number is obtained by executing getNumberFunction
export async function waitForNumberToBeInRange(min, max, getNumberFunction) {
  const timeout = 5000;

  let value;
  try {
    await wait(async () => {
      value = await getNumberFunction();
      return value > min && value <= max;
    }, timeout);
  } catch (err) {
    throw new Error(`Expected value: ${min} < value <= ${max}. Actual value: ${value}`);
  }
  return value;
}

// Blocks ads on blockHideLocalhostUrl between a range, including checking
export async function blockAds(expectedMinBlocked, expectedMaxBlocked, getPopupBlockedAds) {
  const timeout = 8000;

  let errorMessage;
  let adsBlocked;
  try {
    // under certain conditions the ads are not being blocked after loading blockHideUrl,
    // so we have to retry until ads are blocked
    await wait(async () => {
      await openNewTab(blockHideLocalhostUrl);
      try {
        adsBlocked = await waitForNumberToBeInRange(
          expectedMinBlocked,
          expectedMaxBlocked,
          getPopupBlockedAds,
        );
        return true;
      } catch (err) {
        errorMessage = err.message;
      }
    }, timeout);
  } catch (e) {
    throw new Error(`${errorMessage}\nTimed out after ${timeout}ms`);
  }

  return adsBlocked;
}

export async function setUserId(initOptionsFn, userId) {
  const currentHandle = await driver.getWindowHandle();
  const optionsHandle = getOptionsHandle();
  if (currentHandle !== optionsHandle) {
    await initOptionsFn(getOptionsHandle());
  }
  await driver.executeAsyncScript(async (userid, callback) => {
    await browser.storage.local.set({ userid });
    callback();
  }, userId);
  await driver.switchTo().window(currentHandle);
}

export async function setIPMServer(initOptionsFn) {
  return sendExtMessage(initOptionsFn, {
    type: "prefs.set",
    key: "ipm_server_url",
    value: "http://localhost:3007/ipm",
  });
}

export async function setIPMServerResponse(response) {
  await fetch(`http://localhost:3007/setIPMResponse`, {
    method: "POST",
    cache: "no-cache",
    headers: { "Content-Type": "application/json" },
    body: response,
  });
}

export async function setIPMCooldowns(initOptionsFn) {
  await sendExtMessage(initOptionsFn, {
    type: "prefs.set",
    key: "new_tab_cool_down",
    value: 500,
  });

  return sendExtMessage(initOptionsFn, {
    type: "prefs.set",
    key: "onpage_dialog_cool_down",
    value: 2000,
  });
}

export async function pingIPMServer(initOptionsFn) {
  await sendExtMessage(initOptionsFn, {
    type: "prefs.set",
    key: "ipm_last_ping",
    value: 0,
  });
  return sendExtMessage(initOptionsFn, {
    type: "ipm:testing.ping_ipm_server",
  });
}

export async function getIPMCommands(initOptionsFn, fragmentType) {
  const ipmStorageKey = fragmentType === "legacy" ? "ipm_commands" : "ipm:stored_commands";

  return sendExtMessage(initOptionsFn, {
    type: "prefs.get",
    key: ipmStorageKey,
  });
}

export async function getSelectedFragmentType(initOptionsFn) {
  return sendExtMessage(initOptionsFn, {
    type: "testing.getSelectedFragmentType",
  });
}

export async function resetIPMFragment(initOptionsFn) {
  return sendExtMessage(initOptionsFn, {
    type: "testing.resetIPMFragment",
  });
}

export async function setIPMFragment(initOptionsFn, fragmentType) {
  return sendExtMessage(initOptionsFn, {
    type: "testing.setIPMFragment",
    fragmentType,
  });
}
