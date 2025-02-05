/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

require("dotenv").config({
  path: ["../../.env.e2e", "../../.env.e2e.defaults"]
});
const fs = require("fs");
const path = require("path");

const GeneralPage = require("./page-objects/general.page");
const PremiumPage = require("./page-objects/premium.page");
const PremiumCheckoutPage = require("./page-objects/premiumCheckout.page");
const PremiumHeaderChunk = require("./page-objects/premiumHeader.chunk");

const globalRetriesNumber = 0;

const chromeBuildMV2 = findFirstMatchingFile(
  `../../${process.env.CHROME_BUILD_MV2}`
);

const distPath = path.join(process.cwd(), "..", "..", "dist");
const helperExtensionMV2Path = path.join(
  distPath,
  "devenv",
  "helper-extension-mv2.zip"
);
const helperExtensionMV3Path = path.join(
  distPath,
  "devenv",
  "helper-extension-mv3.zip"
);

async function afterSequence(optionsUrl = null) {
  await switchToABPOptionsTab({ optionsUrl, refresh: true });

  const generalPage = new GeneralPage(browser);
  await generalPage.init();

  await waitForAbleToExecuteScripts();
}

async function beforeSequence(
  { expectInstalledTab = true, isSmokeTest = false } = {
    expectInstalledTab: true
  }
) {
  const { origin, optionsUrl, popupUrl, extVersion } = await waitForExtension();
  let installedUrl;
  if (expectInstalledTab) {
    const timeout = process.env.MANIFEST_VERSION == "3" ? 50000 : 25000;
    try {
      await browser.waitUntil(
        async () => {
          for (const handle of await browser.getWindowHandles()) {
            await browser.switchToWindow(handle);
            installedUrl = await browser.getUrl();
            if (/installed|first-run/.test(installedUrl)) {
              await browser.url("about:blank"); // Ensures at least one open tab
              return true;
            }
          }
        },
        {
          timeout,
          interval: 2000,
          timeoutMsg: `Installed page didn't open after ${timeout}ms`
        }
      );
    } catch (e) {
      if (isSmokeTest) {
        throw new Error(
          `Installed page didn't open after ${timeout}ms` +
            " while executing a smoke test"
        );
      }
    }
  }

  // beforeSequence() is usually called once at the beggining of test suites
  // right after extension installation. That may stress the browser for a while
  // which may lead to a situation where the options page is not found (Firefox)
  // To mitigate that, `optionsUrl` is passed here to trigger the fallback
  // mechanism in switchToABPOptionsTab()
  await afterSequence(optionsUrl);

  if (isFirefox()) {
    process.env.MANIFEST_VERSION = "2";
  } else {
    const manifestVersion = await browser.executeScript(
      "return browser.runtime.getManifest().manifest_version;",
      []
    );
    process.env.MANIFEST_VERSION = manifestVersion.toString();
  }

  return { origin, optionsUrl, popupUrl, installedUrl, extVersion };
}

async function doesTabExist(tabName, timeout = 3000, countThreshold = 1) {
  const startTime = new Date().getTime();
  let count = 0;
  const checkTab = async (tabIdentifier) => {
    if (typeof tabIdentifier === "string") {
      const title = await browser.getTitle();
      const url = await browser.getUrl();
      return title === tabIdentifier || url === tabIdentifier;
    } else if (tabIdentifier instanceof RegExp) {
      const url = await browser.getUrl();
      return tabIdentifier.test(url);
    }
    return false;
  };
  while (new Date().getTime() - startTime < timeout) {
    const tabs = await browser.getWindowHandles();
    for (const tab of tabs) {
      await browser.switchToWindow(tab);
      if (await checkTab(tabName)) {
        count++;
      }
    }
    if (count >= countThreshold) {
      return true;
    }
    await browser.pause(200);
  }
  return false;
}

async function enablePremiumProgrammatically() {
  await switchToABPOptionsTab();
  await browser.executeScript(
    `
    Promise.all([
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: "prefs.set",
          key: "premium_license_check_url",
          value: "http://localhost:3006"},
          response => {
          if (browser.runtime.lastError) {
            reject(browser.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      }),
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: "premium.activate",
        userId: "valid_user_id"}, response => {
          if (browser.runtime.lastError) {
            reject(browser.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      })
    ]).then(results => console.log(results));
  `,
    []
  );

  const premiumHeaderChunk = new PremiumHeaderChunk(browser);
  const timeout = 15000;
  await browser.waitUntil(
    async () => {
      try {
        await premiumHeaderChunk.premiumButton.waitForDisplayed();
        return true;
      } catch (e) {
        await browser.refresh();
        await switchToABPOptionsTab({ switchToFrame: true });
      }
    },
    { timeout, timeoutMsg: `Premium button not displayed after ${timeout}ms` }
  );
}

async function enablePremiumByUI() {
  const premiumHeaderChunk = new PremiumHeaderChunk(browser);
  await premiumHeaderChunk.clickUpgradeButton();

  let currentUrl;
  await browser.waitUntil(
    async () => {
      await premiumHeaderChunk.switchToTab(
        /accounts.adblockplus.org\/en\/premium/
      );
      currentUrl = await premiumHeaderChunk.getCurrentUrl();
      return currentUrl.includes("accounts");
    },
    { interval: 1000, timeoutMsg: "Couldn't switch to accounts premium URL" }
  );
  const getPremiumTestModeUrl = `${currentUrl}&testmode`;

  await browser.url(getPremiumTestModeUrl);
  const premiumPage = new PremiumPage(browser);
  await premiumPage.clickGetPremiumMonthlyButton();
  await premiumPage.clickPremiumCheckoutButton();
  const premiumCheckoutPage = new PremiumCheckoutPage(browser);
  await premiumCheckoutPage.init();
  await browser.pause(2000); // the first checkout page may take some time to be ready
  const randomEmail =
    "test_automation" +
    randomIntFromInterval(1000000, 9999999).toString() +
    "@adblock.org";
  await premiumCheckoutPage.typeTextToEmailField(randomEmail);
  // Email is not correctly filled sometimes
  if ((await premiumCheckoutPage.getEmailTextFieldText()) != randomEmail) {
    await premiumCheckoutPage.typeTextToEmailField(randomEmail);
  }
  try {
    await premiumCheckoutPage.typeTextToZIPField("10001");
  } catch (e) {} // Depending on the location, the ZIP may be required or not

  await premiumCheckoutPage.clickContinueButton();
  await browser.pause(2000); // the second checkout page may take some time to be ready
  await premiumCheckoutPage.typeTextToCardNumberField("4242424242424242");
  await premiumCheckoutPage.typeTextToCardExpiryField("0528");
  await premiumCheckoutPage.typeTextToCardCvcField("295");
  await premiumCheckoutPage.typeTextToNameOnCardField("Test Automation");
  await premiumCheckoutPage.clickSubscribeButton();

  // Real premium takes a while to be enabled
  const timeout = 80000;
  await switchToABPOptionsTab({ refresh: true });
  await browser.waitUntil(
    async () => {
      try {
        await premiumHeaderChunk.premiumButton.waitForDisplayed();
        return true;
      } catch (e) {
        await switchToABPOptionsTab({ refresh: true });
      }
    },
    { timeout, timeoutMsg: `Premium button not displayed after ${timeout}ms` }
  );
}

async function executeAsyncScript(script, ...args) {
  const [isError, value] = await browser.executeAsyncScript(
    `
    let promise = (async function() { ${script} }).apply(null, arguments[0]);
    let callback = arguments[arguments.length - 1];
    promise.then(
      res => callback([false, res]),
      err => callback([true, err instanceof Error ? err.message : err])
    );`,
    args
  );

  if (isError) throw new Error(value);
  return value;
}

async function getABPOptionsTabId() {
  await switchToABPOptionsTab({ switchToFrame: false });
  const currentTab = await browser.executeAsyncScript(
    `
    function getTabID()
    {
      return new Promise((resolve, reject) =>
      {
        try
        {
          chrome.tabs.query({active: true,}, function (tabs)
          {
            resolve(tabs[0].id);})} catch (e) {reject(e);
          }
        })
      }
      async function returnID()
      {
        let responseTabID = await getTabID();
        return responseTabID;}
        var callback = arguments[arguments.length - 1];
        returnID().then((data)=> {callback(data)
      });`,
    []
  );
  return currentTab;
}

function findFirstMatchingFile(pathWithPattern) {
  const dir = path.dirname(pathWithPattern);
  const pattern = path.basename(pathWithPattern);
  const regexPattern = new RegExp(pattern.replace("*", ".*"));

  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    if (!err.message.includes("ENOENT: no such file or directory")) throw err;

    throw new Error("The 'dist/release/' folder does not exist");
  }

  const firstFile = files.find((file) => regexPattern.test(file));
  if (firstFile) return path.join(dir, firstFile);

  console.warn(`No file with pattern ${pattern} found in dir ${dir}`);
}

function getExtension(extensionPath) {
  return fs.readFileSync(extensionPath).toString("base64");
}

function getChromiumMV2Extension() {
  return getExtension(chromeBuildMV2);
}

function getHelperExtension(manifestVersion) {
  let helperExtensionPath;
  if (manifestVersion == "MV2") {
    helperExtensionPath = helperExtensionMV2Path;
  } else if (manifestVersion == "MV3") {
    helperExtensionPath = helperExtensionMV3Path;
  }
  return getExtension(helperExtensionPath);
}

function getCurrentDate(locale) {
  return new Date().toLocaleDateString(locale);
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function switchToABPOptionsTab(options = {}) {
  const defaultOptions = {
    switchToFrame: true,
    optionsUrl: null,
    refresh: false
  };
  const { switchToFrame, optionsUrl, refresh } = {
    ...defaultOptions,
    ...options
  };
  const timeout = 5000;
  const quickTimeout = 1000;

  const generalPage = new GeneralPage(browser);
  try {
    await generalPage.switchToTab("Adblock Plus Options", quickTimeout);
  } catch (err) {
    // optionsUrl is passed when the options tab is expected to be closed
    if (!optionsUrl) throw err;

    // When the extension reloads WDIO seems to get confused about the current
    // tab, producing a "no such window" error on any browsing command.
    // Switching to the handle of any open tab as a workaround.
    await browser.switchToWindow((await browser.getWindowHandles())[0]);
    await browser.url(optionsUrl);
    await generalPage.switchToTab("Adblock Plus Options", timeout);
  }

  if (refresh) await browser.refresh();

  if (!switchToFrame) return;

  await browser.waitUntil(
    async () => {
      if (await generalPage._generalTabButton.isClickable()) return true; // already in the content frame

      try {
        await browser.switchToFrame(await $("#content"));
        return true;
      } catch (e) {}
    },
    {
      timeout,
      timeoutMsg: `Could not switch to options content frame after ${timeout}ms`
    }
  );
}

function waitForSwitchToABPOptionsTab(optionsUrl, timeout = 5000) {
  return browser.waitUntil(
    async () => {
      try {
        await switchToABPOptionsTab({ optionsUrl });
        return true;
      } catch (e) {}
    },
    {
      timeout,
      interval: 1000,
      timeoutMsg: `Could not switch to ABP Options Tab after ${timeout}ms`
    }
  );
}

// Wait until the extension doesn't make webdriver throw when running scripts
// Only needed by firefox
async function waitForAbleToExecuteScripts(timeout = 15000) {
  if (!isFirefox()) return;

  return browser.waitUntil(
    async () => {
      try {
        return await browser.executeScript("return true;", []);
      } catch (e) {}
    },
    {
      timeout,
      interval: 2000,
      timeoutMsg: `Webdriver can't execute scripts after ${timeout}ms`
    }
  );
}

// Under stress conditions, for some reason browser.newWindow() may silently
// fail. This is a workaround to ensure it either worked or timed out
async function waitForNewWindow(url, timeout = 5000) {
  await browser.newWindow(url);
  return browser.waitUntil(
    async () => {
      try {
        await browser.switchWindow(url);
        return true;
      } catch (e) {
        await browser.url(url);
      }
    },
    {
      timeout,
      timeoutMsg: `Could not open new window "${url}" after ${timeout}ms`
    }
  );
}

// Polling expect function calls until they pass
async function waitForAssertion(
  expectFn,
  {
    timeout = 5000,
    timeoutMsg = "waitForAssertion timed out",
    interval = 500,
    refresh = true
  } = {}
) {
  return browser.waitUntil(
    async () => {
      try {
        await expectFn();
        return true;
      } catch (e) {
        if (refresh) {
          // [IMPORTANT] Due to how ABP options page is structured (actual
          // content is in an iframe), the browser.refresh() command will
          // cause the browser to switch to the top-level browsing context.
          // Make sure you switch back the context after the refresh.
          await browser.refresh();
        }
      }
    },
    { timeout, interval, timeoutMsg: `${timeoutMsg} after ${timeout}ms` }
  );
}

async function waitForCondition(
  condition,
  object = null,
  waitTime = 150000,
  refresh = true,
  pauseTime = 200,
  text = null
) {
  let waitTimeMS = 0;
  let conditionResult = false;
  while (waitTimeMS <= waitTime) {
    if (refresh) {
      await browser.refresh();
    }
    if (object !== null) {
      if (text !== null) {
        conditionResult = (await object[condition]()).includes(text);
      } else {
        conditionResult = await object[condition]();
      }
    } else {
      conditionResult = await condition;
    }
    if (conditionResult == true) {
      break;
    } else {
      await browser.pause(pauseTime);
      waitTimeMS += pauseTime;
    }
  }
  if (waitTimeMS >= waitTime) {
    throw new Error("Condition was not met within the waitTime!");
  }
}

async function waitForExtension() {
  const timeout = 20000;
  let origin;
  let optionsUrl;
  let popupUrl;
  let extVersion;

  await waitForAbleToExecuteScripts();

  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        const extensionInfo = await browser.executeAsync(async (callback) => {
          if (
            typeof browser !== "undefined" &&
            browser.management !== "undefined"
          ) {
            const info = await browser.management.getSelf();
            const manifest = await browser.runtime.getManifest();
            const popupPath = manifest.applications?.gecko
              ? await browser.action.getPopup({})
              : manifest.manifest_version == "3"
                ? `${location.origin}/${manifest.action.default_popup}`
                : `${location.origin}/${manifest.browser_action.default_popup}`;

            callback(
              info.optionsUrl
                ? {
                    origin: location.origin,
                    optionsUrl: info.optionsUrl,
                    popupUrl: popupPath,
                    extVersion: info.version
                  }
                : {}
            );
          } else {
            callback({});
          }
        });

        if (!extensionInfo) return false;

        ({ origin, optionsUrl, popupUrl, extVersion } = extensionInfo);
        if (origin) return true;
      }
    },
    { timeout, timeoutMsg: `Options page not found after ${timeout}ms` }
  );

  return { origin, optionsUrl, popupUrl, extVersion };
}

/**
 * Gets the ID of current tab using the browser.tabs WebExtension API.
 * This is mainly used to work with the popup when it is open in a tab.
 * ⚠️ Make sure the tab you are targeting is loaded before trying to retrieve
 * its ID
 * @param {object} options
 * @param {string} options.title - The title of the tab
 * @param {string} options.urlPattern - A url [match pattern string](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns)
 * @returns {Number} `browser.tabs.TAB_ID_NONE` when tab was not found,
 * or the tab ID from the browser.tabs Web extension API.
 */
async function getTabId({ title, urlPattern }) {
  const currentWindowHandle = await browser.getWindowHandle();
  await switchToABPOptionsTab({ switchToFrame: false });

  const queryOptions = {};
  if (title) {
    queryOptions.title = title;
  }
  if (urlPattern) {
    queryOptions.url = urlPattern;
  }

  const tabId = await browser.executeAsync(
    async (params, done) => {
      try {
        const tabs = await browser.tabs.query(params.queryOptions);
        if (tabs.length) {
          done(tabs[0].id);
          return;
        }
      } catch (error) {
        console.error(error);
      }

      done(browser.tabs.TAB_ID_NONE);
    },
    { queryOptions }
  );

  await browser.switchToWindow(currentWindowHandle);

  return tabId;
}

function isBrowser(browserName) {
  return browser.capabilities.browserName.toLowerCase().includes(browserName);
}

function isChromium() {
  return isChrome();
}

function isChrome() {
  return isBrowser("chrome");
}

function isFirefox() {
  return isBrowser("firefox");
}

function isEdge() {
  return isBrowser("edge");
}

async function uninstallExtension() {
  await browser.executeScript("browser.management.uninstallSelf();", []);

  const generalPage = new GeneralPage(browser);
  await generalPage.switchToUninstalledTab();

  return await browser.getUrl();
}

/**
 * Sends a message to the extension from the options page.
 *
 * @param {object} message The message to be sent to the extension
 */
async function sendExtMessage(message) {
  const currentHandle = await browser.getWindowHandle();

  // open the options page and cleanup the allowlisting
  await switchToABPOptionsTab();

  const extResponse = await browser.executeAsync(async (params, callback) => {
    const result = await browser.runtime.sendMessage(params);
    callback(result);
  }, message);

  // go back to prev page
  await browser.switchToWindow(currentHandle);
  return extResponse;
}

/**
 * Removes a filter.
 * @param {string} filterText The filter text.
 */
async function removeFilter(filterText) {
  return sendExtMessage({
    type: "filters.remove",
    text: filterText
  });
}

/**
 * Adds a filter.
 * @param {string} filterText The filter text.
 */
async function addFilter(filterText) {
  return sendExtMessage({
    type: "filters.add",
    text: filterText
  });
}

/**
 * Changes the value of a pref from the settings page.
 *
 * @param {string} key The pref key
 * @param {any} value the pref value
 * @returns {Promise<void>}
 */
async function updatePrefs(key, value) {
  return sendExtMessage({
    type: "prefs.set",
    key,
    value
  });
}

/**
 * Reload the extension and wait for the options page to be displayed
 *
 * @param {boolean} [suppressUpdatePage=true] - Whether to suppress
 *    the update page or not before reloading
 * @returns {Promise<void>}
 */
async function reloadExtension(suppressUpdatePage = true) {
  // Extension pages will be closed during reload,
  // create a new tab to avoid the "target window already closed" error
  await waitForNewWindow("https://example.com");
  const safeHandle = await browser.getWindowHandle();

  // ensure options page is open
  await switchToABPOptionsTab();
  const optionsUrl = await browser.getUrl();

  // Suppress page or not
  await updatePrefs("suppress_first_run_page", suppressUpdatePage);

  // reload the extension
  await browser.execute(() => browser.runtime.reload());
  // Workaround for `target window already closed`
  await browser.switchToWindow(safeHandle);

  // wait for the extension to be ready and the options page to be displayed
  await waitForSwitchToABPOptionsTab(optionsUrl, 60000);
}

/**
 * Get persistent storage data
 * @param {string} storage Storage data type ["local", "session"].
 * @param {string} key Storage key
 * @returns {*} Storage data
 */
function getFromStorage(storage, key) {
  return browser.executeAsync(
    async (params, callback) => {
      const result = await browser.storage[params.storage].get([params.key]);
      callback(result[params.key]);
    },
    { storage, key }
  );
}

module.exports = {
  afterSequence,
  beforeSequence,
  doesTabExist,
  executeAsyncScript,
  enablePremiumProgrammatically,
  getChromiumMV2Extension,
  getHelperExtension,
  getCurrentDate,
  getTabId,
  enablePremiumByUI,
  globalRetriesNumber,
  switchToABPOptionsTab,
  waitForExtension,
  getABPOptionsTabId,
  waitForCondition,
  waitForNewWindow,
  waitForAssertion,
  isChrome,
  isChromium,
  isFirefox,
  isEdge,
  uninstallExtension,
  addFilter,
  removeFilter,
  reloadExtension,
  updatePrefs,
  getFromStorage
};
