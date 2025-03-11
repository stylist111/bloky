/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

import { expect } from "expect";
import { By } from "selenium-webdriver";
import moment from "moment";

import { localTestPageUrl } from "@eyeo/test-utils/urls";
import {
  getDisplayedElement,
  waitForNotDisplayed,
  waitForCheckboxStatus,
  isCheckboxPropertyEnabled,
  clickOnDisplayedElement,
  openNewTab,
  getTabId,
  wait
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

const optionsPageSleep = 2000;

export async function checkInstallUninstallUrl({ url, appVersion, uninstall }) {
  const { browserName, majorBrowserVersion } = browserDetails;
  const platformVersion = majorBrowserVersion.toString();

  let base = {
    av: appVersion, // application version (=extension version)
    pv: platformVersion, // same as application platform version
    apv: platformVersion // application platform version (=browser version)
  };

  if (uninstall) {
    const todaysDate = moment().utc().format("YYYYMMDD");

    base = {
      ...base,
      c: "0", // corrupted - should be 0
      s: expect.stringMatching(/(0|1|2|3)/), // default subscriptions enabled
      wafc: "0", // always 0 as we don't do that anymore
      link: "uninstalled",
      lang: "en-US",
      ndc: "0",
      ps: expect.stringMatching(/(0|1)/), // premium subscription
      er: expect.stringMatching(/^([a-zA-Z0-9+/,_=]{8}|null)$/), // experiments revision ID. Example: ietbCO3H
      ev: expect.stringMatching(/^[a-zA-Z0-9+/]+=*/), // experiments variants. Example: AQ%3D%3
      fv: expect.stringMatching(new RegExp(`(0|${todaysDate})`)) // filter version. Example: 20241216
    };
  }

  const expectedParams = {
    chromium: {
      ...base,
      an: "adblockpluschrome", // application name
      ap: "chrome", // application
      p: "chromium" // platform
    },
    edge: {
      ...base,
      an: "adblockpluschrome",
      ap: "edge",
      p: "chromium"
    },
    firefox: {
      ...base,
      an: "adblockplusfirefox",
      ap: "firefox",
      p: "gecko"
    }
  }[browserName];

  if (!expectedParams) {
    throw new Error(`Unexpected browser name: ${browserName}`);
  }

  const params = new URLSearchParams(new URL(url).search);
  const actualParams = Object.fromEntries(params);

  expect(actualParams).toEqual(expectedParams);
}

export async function checkBlockHidePage(expectAllowlisted) {
  const timeout = 1000;

  // we want to wait until the extension starts applying EasyList before continuing with the other checks
  await wait(
    async () => {
      try {
        if (expectAllowlisted) {
          await getDisplayedElement("#script-id-full-path", {
            timeout,
            forceRefresh: false
          });
        } else {
          await waitForNotDisplayed("#script-id-full-path", { timeout });
        }
        return true;
      } catch (e) {
        // the extension might not be applying EasyList yet, so we need to reload the page
        await driver.navigate().refresh();
      }
    },
    9000,
    `filters were not applied on page when expectAllowlisted=${expectAllowlisted}`
  );

  await getDisplayedElement("#control-element", {
    timeout,
    forceRefresh: false
  });

  if (expectAllowlisted) {
    await getDisplayedElement("#test-element-class", {
      timeout,
      forceRefresh: false
    });
    await getDisplayedElement("#test-element-id", {
      timeout,
      forceRefresh: false
    });
    await getDisplayedElement("#script-id-regex", {
      timeout,
      forceRefresh: false
    });
  } else {
    await waitForNotDisplayed("#test-element-class", { timeout });
    await waitForNotDisplayed("#test-element-id", { timeout });
    await waitForNotDisplayed("#script-id-regex", { timeout });
  }
}

async function loadOptionsTab(optionsHandle, id, timeout = 5000) {
  await driver.switchTo().window(optionsHandle);

  await wait(
    async () => {
      try {
        await driver.switchTo().frame("content");
        await clickOnDisplayedElement(`#${id}`, { timeout: 1000 });
        return true;
      } catch (err) {
        if (
          err.name !== "NoSuchElementError" &&
          err.name !== "StaleElementReferenceError"
        ) {
          throw err;
        }
        // The options page has stale elements, reloading as a workaround
        await driver.navigate().refresh();
        await driver.sleep(optionsPageSleep); // https://eyeo.atlassian.net/browse/EXT-335
      }
      return false;
    },
    timeout,
    `Couldn't click on "${id}" options tab`
  );
}

export async function clickFLCheckboxAndCheck(
  checkboxSelector,
  { enable = true, isToggle = false, name } = {}
) {
  const enabledBeforeClick = !enable;

  const enabled = await isCheckboxPropertyEnabled(checkboxSelector);
  expect({ name, enabledBeforeClick: enabled }).toEqual({
    name,
    enabledBeforeClick
  });

  await clickOnDisplayedElement(checkboxSelector);
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: enable,
    isProperty: true,
    name
  });

  if (isToggle) {
    await driver.sleep(500); // let the UI toggle move
  }
}

export async function initPopupPage(tabId) {
  const tabIdParam = tabId ? `?testTabId=${tabId}` : "";
  const url = `${extension.popupUrl}${tabIdParam}`;
  const handle = await openNewTab(url);
  await getDisplayedElement(".popup-header", { timeout: 5000 });
  return handle;
}

export async function initPopupWithLocalPage() {
  await openNewTab(localTestPageUrl);
  const tabId = await getTabId(getOptionsHandle());
  await initPopupPage(tabId);
}

export async function initOptionsGeneralTab(
  optionsHandle,
  { timeout = 5000, waitForDefaultState = false } = {}
) {
  await loadOptionsTab(optionsHandle, "tab-general", timeout);
  await getDisplayedElement("#free-list-table", { timeout });
  if (waitForDefaultState) {
    await wait(
      async () => isCheckboxPropertyEnabled("#acceptable-ads-allow"),
      timeout,
      "Acceptable Ads is disabled before clicking"
    );
  }
}

export async function initOptionsAllowlistTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "tab-allowlist");
  await getDisplayedElement("#content-allowlist", { timeout: 5000 });
}

export async function initOptionsAdvancedTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "tab-advanced");
  await getDisplayedElement("#customize", { timeout: 5000 });
}

export async function getPopupBlockedAdsTotalCount() {
  // The popup page needs any tabId to show total ads blocked. The test page
  // is used for that, since it doesn't have any blocking elements
  await initPopupWithLocalPage();

  const elem = await getDisplayedElement("#stats-total .amount", {
    timeout: 2000,
    forceRefresh: false
  });
  const totalCount = await elem.getText();

  await driver.switchTo().window(getOptionsHandle());

  return parseInt(totalCount, 10);
}

export async function setAADefaultState() {
  const checkboxSelector = "#acceptable-ads-allow";

  await initOptionsGeneralTab(getOptionsHandle());
  const aaEnabled = await isCheckboxPropertyEnabled(checkboxSelector);
  if (!aaEnabled) {
    await clickFLCheckboxAndCheck(checkboxSelector, {
      enable: true,
      name: "Acceptable Ads"
    });
  }
}

export async function initOptionsGeneralTabAfterChanges(
  optionsHandle,
  { timeout = 5000 } = {}
) {
  await loadOptionsTab(optionsHandle, "tab-general", timeout);
  await getDisplayedElement("#free-list-table", { timeout });
}

async function getElemTextSafe(elem) {
  let text;
  try {
    text = await elem.getText();
  } catch (err) {
    if (err.name !== "StaleElementReferenceError") {
      throw err;
    }

    console.warn("An element threw a StaleElementReferenceError. Skipping it");
  }

  return text;
}

export async function getCustomFilters({ switchToAdvancedTab = false } = {}) {
  if (switchToAdvancedTab) {
    await initOptionsAdvancedTab(getOptionsHandle());
  }

  const filterElems = await driver.findElements(
    By.css('#custom-filters io-filter-list tr [data-column="rule"] .content')
  );
  const filters = [];
  for (const elem of filterElems) {
    const text = await getElemTextSafe(elem);
    if (text) {
      filters.push(text);
    }
  }

  return filters;
}

export async function addCustomFilters(
  filters,
  { switchToAdvancedTab = false } = {}
) {
  if (switchToAdvancedTab) {
    await initOptionsAdvancedTab(getOptionsHandle());
  }

  const customFiltersInput = await getDisplayedElement(
    "#custom-filters input",
    { forceRefresh: false }
  );

  for (const filter of filters) {
    await customFiltersInput.sendKeys(filter);
    await waitForNotDisplayed("#custom-filters button[disabled]");
    await clickOnDisplayedElement("#custom-filters button");

    await wait(
      async () => (await getCustomFilters()).includes(filter),
      1000,
      `The filter "${filter}" was not shown after being added`
    );
  }
}

export async function clickOnCustomFilterToggleAndCheck(
  filter,
  { switchToAdvancedTab = false, enable = true } = {}
) {
  if (switchToAdvancedTab) {
    await initOptionsAdvancedTab(getOptionsHandle());
  }

  const toggleSelector = `io-filter-list tr:has([title="${filter}"]) io-toggle`;
  const enabledBeforeClick = !enable;

  let enabled = await isCheckboxPropertyEnabled(toggleSelector);
  expect({ filter, enabledBeforeClick: enabled }).toEqual({
    filter,
    enabledBeforeClick
  });

  try {
    await clickOnDisplayedElement(toggleSelector, { timeout: 1000 });
  } catch (e) {
    // The toggle may not appear right after extension installation.
    // Refreshing as a workaround
    await driver.navigate().refresh();
    await initOptionsAdvancedTab(getOptionsHandle());
    await clickOnDisplayedElement(toggleSelector, { timeout: 1000 });
  }

  enabled = await isCheckboxPropertyEnabled(toggleSelector);
  expect({ filter, enabledAfterclick: enabled }).toEqual({
    filter,
    enabledAfterclick: enable
  });

  return toggleSelector;
}

export async function deleteCustomFilters({
  switchToAdvancedTab = false
} = {}) {
  if (switchToAdvancedTab) {
    await initOptionsAdvancedTab(getOptionsHandle());
  }

  const checkboxSelector =
    '#custom-filters thead [data-column="selected"] button';
  await clickOnDisplayedElement(checkboxSelector, { scrollIntoView: true });
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: true,
    isProperty: false
  });

  // even if displayed, the delete button may be ineffective right after
  // checking the filters. Sleeping as a workaround
  await driver.sleep(1000);
  await clickOnDisplayedElement("#custom-filters button.delete");
  await wait(
    async () => (await getCustomFilters()).length === 0,
    1000,
    "Custom filters were not deleted"
  );
}

export async function setPausedStateFromPopup(url, paused = true) {
  const websiteAllowlistBtnSelector = `#page-status > div:first-of-type > io-circle-toggle`;
  const websiteHandle = await openNewTab(url);
  const tabId = await getTabId(getOptionsHandle());

  await initPopupPage(tabId);
  // Clicking right after the popup is loaded may be ineffective, sleeping as a workaround
  await driver.sleep(1000);
  await clickOnDisplayedElement(websiteAllowlistBtnSelector, {
    timeout: 5000
  });
  // Check that the refresh message is shown
  await getDisplayedElement("#page-refresh", {
    forceRefresh: false,
    timeout: 1000
  });

  await getDisplayedElement(websiteAllowlistBtnSelector, {
    timeout: 5000,
    forceRefresh: false
  });
  const enabled = await isCheckboxPropertyEnabled(websiteAllowlistBtnSelector);
  expect(enabled).not.toEqual(paused);
  await driver.close();

  await driver.switchTo().window(websiteHandle);
  await driver.close();
  await driver.switchTo().window(getOptionsHandle());
}

export async function addAllowlistFilters(filters) {
  await initOptionsAllowlistTab(getOptionsHandle());

  const allowlistFiltersInput = await getDisplayedElement(
    "#allowlisting-textbox"
  );

  for (const filter of filters) {
    await allowlistFiltersInput.sendKeys(filter);
    await clickOnDisplayedElement("#allowlisting-add-button");
  }
}

export async function deleteFirstAllowlistFilter() {
  await initOptionsAllowlistTab(getOptionsHandle());
  await clickOnDisplayedElement("#allowlisting-table button");
}

export async function checkPremiumActivated({
  timeout = 30000,
  retry = 0,
  maxRetries = 10
} = {}) {
  await driver.switchTo().window(getOptionsHandle());
  await driver.navigate().refresh();
  await initOptionsGeneralTab(getOptionsHandle());

  // Premium has been activated
  const premiumSelectors = [
    ".button.premium-label",
    ".premium-banner-container",
    'a[data-i18n="options_premium_manage"]'
  ];

  try {
    for (const selector of premiumSelectors) {
      await getDisplayedElement(selector);
    }
  } catch (e) {
    if (retry >= maxRetries) {
      throw new Error("Premium elements not found after 3 retries");
    }

    console.warn(
      `Premium elements not found, wait ${timeout}ms and retry... [${retry + 1}]`
    );
    await driver.sleep(timeout);
    return checkPremiumActivated({ timeout, maxRetries, retry: retry + 1 });
  }
}

export async function enablePremiumProgrammatically() {
  await initOptionsGeneralTab(getOptionsHandle(), {
    waitForDefaultState: true
  });

  const error = await driver.executeAsyncScript(async (callback) => {
    try {
      await browser.runtime.sendMessage({
        type: "prefs.set",
        key: "premium_license_check_url",
        value: "http://localhost:3006"
      });
      await browser.runtime.sendMessage({
        type: "premium.activate",
        userId: "valid_user_id"
      });
    } catch (err) {
      callback(err);
    }
    callback();
  });

  if (error) throw new Error(error);

  await checkPremiumActivated();
}

export function getFLSelectors(name) {
  const flSelector = `#all-filter-lists-table [aria-label="${name}"]`;

  return {
    filterlist: flSelector,
    toggle: `${flSelector} io-toggle`,
    title: `${flSelector} span[data-display]`,
    gear: `${flSelector} [type="menubar"]`,
    sourceLink: `${flSelector} [type="menubar"] [data-i18n="options_filterList_source"]`,
    trashBtn: `${flSelector} [data-action="remove-subscription"]`,
    lastUpdate: `${flSelector}  .last-update`,
    tooltip: `${flSelector} [type="tooltip"]`
  };
}

export async function waitForSubscriptionUpdated(
  name,
  { timeout = 2000, regexp = /Just now|minutes ago/ } = {}
) {
  const { toggle, lastUpdate } = getFLSelectors(name);

  await wait(
    async () => {
      // Filterlist status may be stuck on 'Updating' unless the page is reloaded
      // https://eyeo.atlassian.net/browse/EXT-402
      await driver.navigate().refresh();
      await initOptionsAdvancedTab(getOptionsHandle());

      const flEnabled = await isCheckboxPropertyEnabled(toggle);
      try {
        const lastUpdatedElem = await getDisplayedElement(lastUpdate, {
          timeout: 800,
          forceRefresh: false
        });
        const text = await lastUpdatedElem.getText();

        return flEnabled && regexp.test(text);
      } catch (e) {}
    },
    timeout,
    `${name} was not updated`
  );
}

async function getPopupLanguageFilterLists(isOptionsGeneralTab) {
  const popupSelector = isOptionsGeneralTab
    ? "#languages-boxpopup"
    : "#filters-boxpopup";

  // Poll until elements are not stale
  let languageElems;
  await wait(
    async () => {
      languageElems = await driver.findElements(By.css(`${popupSelector} li`));
      try {
        await languageElems[languageElems.length - 1].getText();
        return true;
      } catch (err) {
        if (err.name !== "StaleElementReferenceError") {
          throw err;
        }
      }
    },
    2000,
    "Language elements text is not avaliable"
  );

  return languageElems;
}

export async function getLanguageFilterLists(isOptionsGeneralTab) {
  const boxSelector = isOptionsGeneralTab ? "#languages-box" : "#filters-box";
  await clickOnDisplayedElement(boxSelector, { scrollIntoView: true });

  return await getPopupLanguageFilterLists(isOptionsGeneralTab);
}

async function checkLanguageFilterList(
  langName,
  { isAdded = true, isOptionsGeneralTab = true } = {}
) {
  const timeout = 2000;
  const tableSelector = isOptionsGeneralTab
    ? "#blocking-languages-table"
    : "#all-filter-lists-table";
  const filterlistSelector = `${tableSelector} [aria-label="${langName}"]`;
  if (isAdded) {
    await getDisplayedElement(filterlistSelector, {
      timeout,
      forceRefresh: false
    });
  } else {
    await waitForNotDisplayed(filterlistSelector, { timeout });
  }

  return filterlistSelector;
}

export async function addLanguageFilterList(
  langName,
  { isOptionsGeneralTab = true, isLanguagesPopupOpen = false } = {}
) {
  const languageElems = isLanguagesPopupOpen
    ? await getPopupLanguageFilterLists(isOptionsGeneralTab)
    : await getLanguageFilterLists(isOptionsGeneralTab);

  let langElem;
  for (const elem of languageElems) {
    const text = await getElemTextSafe(elem);
    if (text && text.startsWith(langName)) {
      langElem = elem;
      break;
    }
  }
  if (!langElem) {
    const text = isOptionsGeneralTab ? "languages box" : "filters box";
    throw new Error(`${langName} EasyList was not found on ${text}`);
  }
  await langElem.click();

  await checkLanguageFilterList(langName, { isOptionsGeneralTab });
}

export async function changeLanguageFilterList(langNameBefore, langNameAfter) {
  const isOptionsGeneralTab = true;
  const flSelector = await checkLanguageFilterList(langNameBefore, {
    isAdded: true,
    isOptionsGeneralTab
  });

  const changeFilterlistSelector = `${flSelector} [data-action="open-languages-box"]`;
  await clickOnDisplayedElement(changeFilterlistSelector, {
    scrollIntoView: true
  });
  // Clicking on changeFilterlistSelector opens the languages popup
  await addLanguageFilterList(langNameAfter, {
    isOptionsGeneralTab,
    isLanguagesPopupOpen: true
  });
  // Check langNameBefore list has been removed
  await checkLanguageFilterList(langNameBefore, {
    isAdded: false,
    isOptionsGeneralTab
  });
}
