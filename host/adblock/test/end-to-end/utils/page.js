/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { By, Key } from "selenium-webdriver";
import { expect } from "expect";

import { localTestPageUrl } from "@eyeo/test-utils/urls";
import {
  getDisplayedElement,
  openNewTab,
  findUrl,
  waitForNotNullProperty,
  isCheckboxPropertyEnabled,
  waitForNotDisplayed,
  clickAndCloseNewTab,
  getTabId,
  clickOnDisplayedElement,
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, sendExtMessage } from "@eyeo/test-utils/extension";

import { installUrl } from "./urls.js";

const optionsPageSleep = 3000;

export async function initPopupPage(tabId) {
  const tabIdParam = tabId ? `?tabId=${tabId}` : "";
  const url = `${extension.popupUrl}${tabIdParam}`;
  const handle = await openNewTab(url);
  await getDisplayedElement(".header-logo", { timeout: 5000 });
  return handle;
}

export async function initPopupWithLocalPage() {
  await openNewTab(localTestPageUrl);
  const tabId = await getTabId(getOptionsHandle());
  await initPopupPage(tabId);
}

async function loadOptionsTab(optionsHandle, id) {
  await driver.switchTo().window(optionsHandle);

  await driver.wait(
    async () => {
      try {
        await clickOnDisplayedElement(`[href="#${id}"]`);
        return true;
      } catch (err) {
        if (err.name !== "NoSuchElementError" && err.name !== "StaleElementReferenceError") {
          throw err;
        }
        // The options page has stale elements, reloading as a workaround
        await driver.navigate().refresh();
        await driver.sleep(optionsPageSleep); // https://eyeo.atlassian.net/browse/EXT-335
      }
      return false;
    },
    5000,
    `Couldn't click on "${id}" options tab`,
  );

  // Make sure the URL is updated
  await driver.wait(
    async () => {
      return (await driver.getCurrentUrl()).endsWith(`#${id}`);
    },
    3000,
    `Clicking on "${id}" options tab didn't load the tab url`,
  );
}

export async function initOptionsFiltersTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "filters");
  // Wait until a filterlist is displayed
  await getDisplayedElement('[name="easylist"]', { timeout: 8000 });
}

export async function initOptionsCustomizeTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "customize");
}

export async function initOptionsGeneralTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "general");
  await waitForNotNullProperty("#acceptable_ads", "checked");
  await driver.sleep(optionsPageSleep); // https://eyeo.atlassian.net/browse/EXT-335
}

export async function initOptionsPremiumTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "mab");
  await driver.sleep(optionsPageSleep); // https://eyeo.atlassian.net/browse/EXT-335
  await driver.navigate().refresh(); // Workaround for the "get-it-now" element to appear
}

export async function initOptionsThemesTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "mab-themes");
}

export async function initOptionsImageSwapTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "mab-image-swap");
}

export async function initOptionsBackupSyncTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "sync");
}

export async function initOptionsPremiumFlTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "premium-filters");
  await getDisplayedElement("#premium-filter-lists > div:nth-child(2)", { timeout: 2000 });
}

export async function getCustomFilters() {
  const filters = await waitForNotNullProperty("#txtFiltersAdvanced", "value", 2000);
  return filters.split("\n");
}

export async function setCustomFilters(filters, append = false) {
  await initOptionsCustomizeTab(getOptionsHandle());
  const editButton = await getDisplayedElement("#btnEditAdvancedFilters", { timeout: 2000 });

  // The edit button functionality may take some time to be ready.
  // Retrying as a workaround
  let saveButton;
  await driver.wait(
    async () => {
      try {
        await editButton.click();
        saveButton = await getDisplayedElement("#btnSaveAdvancedFilters", { forceRefresh: false });
        return true;
      } catch (e) {}
    },
    5000,
    "btnSaveAdvancedFilters was not displayed",
  );

  const filtersAdvancedElem = await getDisplayedElement("#txtFiltersAdvanced");
  if (!append) {
    await filtersAdvancedElem.clear();
  }

  for (const filter of filters) {
    await filtersAdvancedElem.sendKeys(Key.RETURN);
    await filtersAdvancedElem.sendKeys(filter);
  }
  await saveButton.click();
}

export async function getUserIdFromInstallPage() {
  await findUrl(installUrl);

  let userId;
  await driver.wait(
    async () => {
      try {
        userId = await driver.executeScript(() => {
          return document.getElementById("adblockUserId").textContent;
        });
        return true;
      } catch (err) {}
    },
    5000,
    "adblockUserId was not found",
  );

  return userId;
}

export async function getUserIdFromStorage(optionsHandle) {
  const currentHandle = await driver.getWindowHandle();

  await driver.switchTo().window(optionsHandle);
  const userId = await driver.executeAsyncScript(async (callback) => {
    const res = await browser.storage.local.get("userid");
    callback(res.userid);
  });

  await driver.switchTo().window(currentHandle);
  return userId;
}

export async function getSubscriptionInfo(name, timeout = 5000) {
  let text;
  await driver.wait(
    async () => {
      const info = await driver.findElement(By.css(`[name="${name}"] .subscription_info`));
      text = await info.getText();
      return text !== "";
    },
    timeout,
    `Getting subscription ${name} info timeod out after ${timeout}ms`,
  );

  return text;
}

// This function assumes initOptionsFiltersTab() being called beforehand
export async function clickFilterlist(name, checkboxSelector, enabledAfterClick) {
  await clickOnDisplayedElement(`[name="${name}"]`);

  // Language filter lists get removed from the UI after disabling them.
  // In that case no further checks are done here
  if (!checkboxSelector) {
    return;
  }

  const text = enabledAfterClick ? "enabled" : "disabled";
  await driver.wait(
    async () => {
      return (await isCheckboxPropertyEnabled(checkboxSelector)) === enabledAfterClick;
    },
    1000,
    `The filterlist "${name}" was not ${text} after clicking`,
  );
}

/**
 * Add filters to AdBlock
 *
 * @param {string} filters - The filter rules to add
 * @returns {Promise<void>}
 */
export async function programaticallyAddFilters(filters) {
  const err = await driver.executeAsyncScript(async (filtersToAdd, callback) => {
    const errors = await browser.runtime.sendMessage({
      type: "filters.importRaw",
      text: filtersToAdd,
    });
    if (typeof errors !== "undefined" && errors[0]) {
      callback(errors[0]);
    }

    callback();
  }, filters);

  if (err) {
    throw new Error(err);
  }
}

/**
 * Checked that the elements from the blockHideUrl are allowlisted or not.
 *
 * @param {boolean} [expectAllowlisted=false] - Whether the page is allowlisted
 * @returns {Promise<void>}
 */
export async function checkBlockHidePage(expectAllowlisted) {
  const timeout = 1000;

  // we want to wait until the extension starts applying EasyList before continuing with the other checks
  await driver.wait(
    async () => {
      try {
        if (expectAllowlisted) {
          await getDisplayedElement("#script-id-full-path", { timeout, forceRefresh: false });
        } else {
          await waitForNotDisplayed("#script-id-full-path", timeout);
        }
        return true;
      } catch (e) {
        // the extension might not be applying EasyList yet, so we need to reload the page
        await driver.navigate().refresh();
      }
    },
    9000,
    `filters were not applied on page when expectAllowlisted=${expectAllowlisted}`,
  );

  await getDisplayedElement("#control-element", { timeout, forceRefresh: false });

  if (expectAllowlisted) {
    await getDisplayedElement("#test-element-class", { timeout, forceRefresh: false });
    await getDisplayedElement("#test-element-id", { timeout, forceRefresh: false });
    await getDisplayedElement("#script-id-regex", { timeout, forceRefresh: false });
  } else {
    await waitForNotDisplayed("#test-element-class", timeout);
    await waitForNotDisplayed("#test-element-id", timeout);
    await waitForNotDisplayed("#script-id-regex", timeout);
  }
}

/**
 * Removes a filter.
 * @param {string} filterText The filter text.
 */
export async function removeFilter(filterText) {
  return sendExtMessage(initOptionsGeneralTab, {
    type: "filters.remove",
    text: filterText,
  });
}

/**
 * Adds a filter.
 * @param {string} filterText The filter text.
 */
export async function addFilter(filterText) {
  return sendExtMessage(initOptionsGeneralTab, {
    type: "filters.add",
    text: filterText,
  });
}

/**
 * Changes a pref by sending a message to the extension on the settings page.
 *
 * @param {string} key The pref key name
 * @param {*} value The pref value
 */
export async function updatePrefs(key, value) {
  return sendExtMessage(initOptionsGeneralTab, {
    type: "prefs.set",
    key,
    value,
  });
}

export async function checkPremiumPageHeader(ctaTextSelector, ctaLinkSelector, premiumURL) {
  // sometimes the elements are displayed with a delay
  const ctaText = await getDisplayedElement(ctaTextSelector, {
    timeout: 4000,
    forceRefresh: false,
  });
  expect(await ctaText.getText()).toEqual(
    "You’ll be an ad blocking pro with these easy-to-use add-ons.",
  );

  const ctaLink = await getDisplayedElement(ctaLinkSelector);
  expect(await ctaLink.getText()).toEqual("Get It Now");

  await clickAndCloseNewTab(ctaLinkSelector, premiumURL);
}

export async function setAADefaultState() {
  const name = "acceptable_ads";
  const checkboxSelector = "#adblockFilterList_0";

  await initOptionsFiltersTab(getOptionsHandle());
  const aaEnabled = await isCheckboxPropertyEnabled(checkboxSelector);
  // Cleanup setting the AA default state
  if (!aaEnabled) {
    await clickFilterlist(name, checkboxSelector, true);
  }
}

export async function waitForSubscribed(
  name,
  checkboxSelector,
  { timeout = 3000, allowFetching = false } = {},
) {
  const regexp = allowFetching ? /updated|Subscribed|Fetching/ : /updated|Subscribed/;

  await driver.wait(
    async () => {
      const flEnabled = await isCheckboxPropertyEnabled(checkboxSelector);
      const text = await getSubscriptionInfo(name);
      return flEnabled && regexp.test(text);
    },
    timeout,
    `${name} was not updated/subscribed/fetching after adding it`,
  );
}

export async function setPausedStateFromPopup(url, paused = true) {
  const pauseBtnSelector = "[data-text='domain_pause_adblock']";
  const unpauseBtnSelector = "[data-text='unpause_adblock']";
  const beforeClickBtn = paused ? pauseBtnSelector : unpauseBtnSelector;
  const afterClickBtn = paused ? unpauseBtnSelector : pauseBtnSelector;

  // open new tab with the URL that will be allowlisted
  const websiteHandle = await openNewTab(url);

  // initialize the popup for the above page
  const tabId = await getTabId(getOptionsHandle());
  await initPopupPage(tabId);

  // click on the 'Pause' or 'Unpause' button
  await clickOnDisplayedElement(beforeClickBtn, {
    timeout: 5000,
    checkDisplayed: false, // Sometimes isDisplayed() returns false, even though the button can be clicked
  });

  await driver.switchTo().window(websiteHandle);
  await driver.navigate().refresh();

  // re-open the popup and check state changed
  await initPopupPage(tabId);
  await getDisplayedElement(afterClickBtn, {
    timeout: 5000,
    forceRefresh: false,
    checkDisplayed: false,
  });
  await driver.close();

  // switch to the page
  await driver.switchTo().window(websiteHandle);
  await driver.close();
  await driver.switchTo().window(getOptionsHandle());
}

export async function getPopupBlockedAdsTotalCount() {
  // The popup page needs any tabId to show total ads blocked. The test page
  // is used for that, since it doesn't have any blocking elements
  await initPopupWithLocalPage();

  const elem = await getDisplayedElement(
    "#popup_sections popup-detail-stats > div:nth-child(2) > span",
    { timeout: 2000, forceRefresh: false },
  );
  const totalCount = await elem.getText();

  await driver.switchTo().window(getOptionsHandle());

  return parseInt(totalCount, 10);
}

export async function enablePremiumProgrammatically() {
  const currentDate = new Date();
  const options = { year: "numeric", month: "long" };
  const formattedDate = currentDate.toLocaleDateString("en-US", options).toUpperCase();
  const expectedValues = [`SUPPORTER SINCE ${formattedDate}`, "ACTIVE"];

  let premiumStatus;
  // Occasionally the `adblock:activate` message has no effect in the premium
  // status. In that case the activation flow is retried.
  await driver.wait(
    async () => {
      await sendExtMessage(initOptionsGeneralTab, { type: "adblock:activate" }); // activate premium
      await initOptionsPremiumTab(getOptionsHandle());

      try {
        premiumStatus = await getDisplayedElement("#premium_status_msg", {
          timeout: 4000, // Premium status message may take a while to appear
          forceRefresh: false,
        });
        return true;
      } catch (err) {
        if (err.name === "TimeoutError") {
          console.warn("Temporary premium wasn't activated. Retrying...");
          return false;
        }

        throw err;
      }
    },
    10000,
    "Temporary premium couldn't be activated",
  );

  const premiumStatusText = await premiumStatus.getText();
  if (!expectedValues.includes(premiumStatusText)) {
    throw new Error(`Unexpected premium status after activation: ${premiumStatusText}`);
  }
}
