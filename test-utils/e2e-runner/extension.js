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

import { openNewTab } from "./driver.js";
import { localTestPageUrl } from "../test-server/urls.js";

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
      const { shortName, version, permissions, optionsUrl } = await browser.management.getSelf();
      const origin = optionsUrl ? location.origin : null;
      const manifest = await browser.runtime.getManifest();
      const popupUrl = manifest.applications?.gecko
        ? await browser.action.getPopup({})
        : manifest.manifest_version == "3"
          ? `${location.origin}/${manifest.action.default_popup}`
          : `${location.origin}/${manifest.browser_action.default_popup}`;
      callback({ name: shortName, version, origin, permissions, popupUrl });
    } else {
      callback({});
    }
  });

  if (!info || !info.origin) {
    throw new Error("Origin was not found");
  }

  info.manifestVersion = 2;
  if (
    info.permissions.includes("declarativeNetRequest") ||
    info.permissions.includes("declarativeNetRequestWithHostAccess")
  ) {
    info.manifestVersion = 3;
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
async function updateSettings(initOptionsFn, name, isEnabled) {
  return sendExtMessage(initOptionsFn, {
    command: "setSetting",
    name,
    isEnabled,
  });
}

/**
 * Reload the extension and wait for the options page to be displayed
 *
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @param {boolean} [suppressUpdatePage=true] - Whether to suppress
 *   the update page or not before reloading
 * @returns {Promise<void>}
 */
export async function reloadExtension(initOptionsFn, suppressUpdatePage = true) {
  // Extension pages will be closed during reload,
  // create a new tab to avoid the "target window already closed" error
  const safeHandle = await openNewTab(localTestPageUrl);

  // Suppress page or not
  await updateSettings(initOptionsFn, "suppress_update_page", suppressUpdatePage);

  // reload the extension
  await initOptionsFn(getOptionsHandle());
  await driver.executeScript(() => browser.runtime.reload());
  // Workaround for `target window already closed`
  await driver.switchTo().window(safeHandle);

  // Wait until the current option page is closed by the reload
  // otherwise the next step will fail
  await driver.wait(
    async () => {
      const handlers = await driver.getAllWindowHandles();
      return !handlers.includes(getOptionsHandle());
    },
    5000,
    "Current option page was not closed in time",
  );

  // wait for the extension to be ready and the options page to be displayed
  await driver.wait(
    async () => {
      try {
        await driver.navigate().to(`${extension.origin}/options.html`);
        setOptionsHandle(await driver.getWindowHandle());
        // The timeout parameter is only used by ABP
        await initOptionsFn(getOptionsHandle(), 10000);
        return true;
      } catch (e) {
        await driver.navigate().refresh();
      }
    },
    20000,
    "Options page not found after reload",
    1000,
  );
}

/**
 * Replaces the extension files with the current build files, and reloads the extension
 * @param {Function} initOptionsFn - Function that initialises the options page, specific to each host
 * @returns {Promise<void>}
 */
export async function upgradeExtension(initOptionsFn) {
  const { buildsDirPath, unpackedUpgradeDirPath } = global.config;

  // replace the contents of the extension with the files from the current builds
  await extractExtension(buildsDirPath, unpackedUpgradeDirPath);

  // Change the extension version to check the upgrade mechanism works
  await changeExtensionVersion(unpackedUpgradeDirPath);

  // reload the extension
  await reloadExtension(initOptionsFn);

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
  await initOptionsFn(getOptionsHandle());

  await driver.executeScript(() => {
    browser.management.uninstallSelf();
  });
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
