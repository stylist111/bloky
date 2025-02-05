import fs from "fs";
import path from "path";
import { findProjectRoot } from "@eyeo/test-utils";
import {
  extractExtension,
  findExtensionPath,
  getFileAsBase64,
  getManifestVersionArg,
  isFirefoxArg,
  loadChromiumExtensions,
  startBrowser
} from "./helpers.mjs";

const rootDir = findProjectRoot();
const testDir = path.join(rootDir, "test", "end-to-end-deprecated");
const screenshotsPath = path.join(testDir, "screenshots");

// Removes the screenshots folder
export async function removeScreenshots() {
  await fs.promises.rm(screenshotsPath, { recursive: true, force: true });
}

/**
 * Hook to take a screenshot after each test if the test failed
 *
 * @param {object} test - Test object
 * @param {object} context - Scope object the test was executed with
 * @param {Error} error - Error object in case the test fails,
 *    otherwise `undefined`
 * @returns {Promise<void>}
 */
export async function screenshotHook(test, context, { error }) {
  // Pending means skipped
  if (!error || error.constructor.name === "Pending") {
    return;
  }

  try {
    const title = test.title
      .replaceAll(" ", "_")
      .replaceAll('"', "")
      .replaceAll(":", "")
      .replaceAll("/", "_");

    await fs.promises.mkdir(screenshotsPath, { recursive: true });
    await browser.saveScreenshot(path.join(screenshotsPath, `${title}.png`));
  } catch (err) {
    console.warn(`Screenshot could not be saved: ${err}`);
  }
}

/**
 * Hook to take a screenshot after each test if the test failed
 *
 * @returns {Promise<void>}
 */
export async function seleniumScreenshotsHook() {
  const { driver } = global;

  if (this.currentTest.state !== "failed") {
    return;
  }

  const data = await driver.takeScreenshot();
  const base64Data = data.replace(/^data:image\/png;base64,/, "");
  const title = this.currentTest.title.replaceAll(" ", "_");

  // ensure screenshots directory exists and write the screenshot to a file
  await fs.promises.mkdir(screenshotsPath, { recursive: true });
  await fs.promises.writeFile(
    path.join(screenshotsPath, `${title}.png`),
    base64Data,
    "base64"
  );
}

/**
 * Hook to log info about the current run
 * @returns {Promise<void>}
 */
export async function beforeHook() {
  // eslint-disable-next-line no-console
  console.log(`MANIFEST_VERSION=${process.env.MANIFEST_VERSION}`);
}

/**
 * Hook to load the Chromium extension before the test execution
 *
 * @param {Array.<Object>} capabilities - List of capabilities details
 * @param {string} buildsDirPath - The path to the directory containing
 *    the extension builds
 * @returns {Promise<void>}
 */
export async function loadExtensionHook(capabilities, buildsDirPath) {
  const helperDirPath = path.join(findProjectRoot(), "dist", "devenv");

  if (isFirefoxArg()) {
    // load the extension
    const extPath = await findExtensionPath(buildsDirPath);
    const extBase64 = await getFileAsBase64(extPath);
    await browser.installAddOn(extBase64, true);

    // wait a bit before installing another extension
    await browser.pause(500);

    // load helper extension
    const helperExtPath = path.join(helperDirPath, "helper-extension-mv2.zip");
    const helperExtBase64 = await getFileAsBase64(helperExtPath);
    await browser.installAddOn(helperExtBase64, true);

    return;
  }

  // path to extension builds
  const unpackedDirPath = path.join(buildsDirPath, "ext-unpacked");
  await extractExtension(buildsDirPath, unpackedDirPath);

  // path to helper extension build
  const helperUnpackedDirPath = path.join(
    helperDirPath,
    `helper-extension-mv${getManifestVersionArg()}`
  );
  loadChromiumExtensions(capabilities, [
    unpackedDirPath,
    helperUnpackedDirPath
  ]);
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
  global.browserName = browserName;
  global.fullBrowserVersion = fullBrowserVersion;
  global.majorBrowserVersion = majorBrowserVersion;
}

/**
 * Hook to clean up after the tests
 *
 * @returns {Promise<void>}
 */
export async function cleanupHook() {
  const { driver } = global;

  if (driver) {
    await driver.quit();
  }
}
