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
/* global ewe */

import { expect } from "expect";
import { By, until } from "selenium-webdriver";
import moment from "moment";

import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  getDisplayedElement,
  waitForNotDisplayed,
  waitForCheckboxStatus,
  isCheckboxPropertyEnabled,
  clickOnDisplayedElement,
  openNewTab,
  getTabId,
  wait,
  isCheckboxAttributeEnabled
} from "@eyeo/test-utils/driver";
import {
  simulatePremiumActivation,
  simulateDowngradeToFreeUser
} from "@eyeo/test-utils/account";
import {
  getOptionsHandle,
  callOptionsAPI as _callOptionsAPI
} from "@eyeo/test-utils/extension";
import { premiumFilterLists } from "./dataset.js";

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
      link: "uninstalled",
      lang: "en-US"
    };

    // Firefox uses are opted-out of user data gathering.
    if (browserName !== "firefox") {
      base = {
        ...base,
        c: "0", // corrupted - should be 0
        s: expect.stringMatching(/(0|1|2|3)/), // default subscriptions enabled
        wafc: "0", // always 0 as we don't do that anymore
        ndc: "0",
        ps: expect.stringMatching(/(0|1)/), // premium subscription
        er: expect.stringMatching(/^([a-zA-Z0-9+/,_=]{8}|null)$/), // experiments revision ID. Example: ietbCO3H
        ev: expect.stringMatching(/^[a-zA-Z0-9+/]+=*/), // experiments variants. Example: AQ%3D%3
        ca: expect.stringMatching(/^[a-zA-Z0-9+/]+=*/), // cohort assignments. Example: AQ%3D%3
        fv: expect.stringMatching(new RegExp(`(0|${todaysDate})`)) // filter version. Example: 20241216
      };
    }
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
          await getDisplayedElement("#script-id-full-path", { timeout });
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

  await getDisplayedElement("#control-element", { timeout });

  if (expectAllowlisted) {
    await getDisplayedElement("#test-element-class", { timeout });
    await getDisplayedElement("#test-element-id", { timeout });
    await getDisplayedElement("#script-id-regex", { timeout });
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
        await clickOnDisplayedElement(`#${id}`, { timeout: 2000 });
        return true;
      } catch (err) {
        if (
          err.name !== "NoSuchElementError" &&
          err.name !== "StaleElementReferenceError" &&
          err.name !== "TimeoutError"
        ) {
          throw err;
        }
        // The options page has stale or slow-loading elements, reloading as a workaround
        await driver.navigate().refresh();
        await driver.sleep(optionsPageSleep); // https://eyeo.atlassian.net/browse/EXT-335
      }
      return false;
    },
    timeout,
    `Couldn't click on "${id}" options tab`
  );
}

async function clickCheckboxAndCheck(
  checkboxSelector,
  { enable = true, name }
) {
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: !enable,
    isProperty: false,
    name
  });

  await clickOnDisplayedElement(checkboxSelector);
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: enable,
    isProperty: false,
    name
  });
}

export async function clickFLCheckboxAndCheck(
  checkboxSelector,
  { enable = true, isToggle = false, name } = {}
) {
  await waitForCheckboxStatus(checkboxSelector, {
    timeout: 3000,
    expectEnabled: !enable,
    isProperty: true,
    name
  });

  await clickOnDisplayedElement(checkboxSelector);
  await waitForCheckboxStatus(checkboxSelector, {
    timeout: 3000,
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
      "Acceptable Ads is disabled when opening the Options tab"
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
    timeout: 2000
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

export async function setMarketingOptOutState(optOut) {
  const checkboxSelector =
    "[data-pref='notifications_ignoredcategories'] > [data-action='toggle-pref']";

  await initOptionsAdvancedTab(getOptionsHandle());
  const isChecked = await isCheckboxAttributeEnabled(checkboxSelector);
  if (optOut !== isChecked) {
    return;
  }

  await clickCheckboxAndCheck(checkboxSelector, {
    enable: !optOut,
    name: "Marketing opt-out"
  });
}

export async function getElemTextSafe(elem) {
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

  const customFiltersInput = await getDisplayedElement("#custom-filters input");
  for (const filter of filters) {
    await customFiltersInput.sendKeys(filter);
    await waitForNotDisplayed("#custom-filters button[disabled]");
    await clickOnDisplayedElement("#custom-filters button");

    await wait(
      async () => (await getCustomFilters()).includes(filter),
      5000,
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
  await getDisplayedElement("#page-refresh", { timeout: 1000 });

  await getDisplayedElement(websiteAllowlistBtnSelector, { timeout: 5000 });
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

export async function isPremiumActivated() {
  await initOptionsGeneralTab(getOptionsHandle());
  await driver.navigate().refresh();

  // Premium has been activated
  const premiumSelectors = [
    ".button.premium-label",
    ".premium-banner-container",
    'a[data-i18n="options_premium_manage"]',
    "#user-account-manage"
  ];

  try {
    await Promise.all(
      premiumSelectors.map((selector) =>
        getDisplayedElement(selector, { timeout: 5000 })
      )
    );
    return true;
  } catch (e) {
    return false;
  }
}

export async function enablePremiumProgrammatically({ isTrial = false } = {}) {
  const portalUrl = "https://myaccount.adblockplus.org";
  const applicationName = "abp-portal";
  await simulatePremiumActivation(
    portalUrl,
    applicationName,
    initOptionsGeneralTab,
    { isTrial }
  );
}

export async function disablePremiumProgrammatically() {
  await simulateDowngradeToFreeUser(initOptionsGeneralTab);
}

export function getFLSelectors(name, { isOptionsGeneralTab = false } = {}) {
  const tableSelector = isOptionsGeneralTab
    ? "#blocking-languages-table"
    : "#all-filter-lists-table";
  const flSelector = `${tableSelector} [aria-label="${name}"]`;

  return {
    filterlist: flSelector,
    toggle: `${flSelector} io-toggle`,
    title: `${flSelector} span[data-display]`,
    gear: `${flSelector} [type="menubar"]`,
    sourceLink: `${flSelector} [type="menubar"] [data-i18n="options_filterList_source"]`,
    trashBtn: `${flSelector} [data-action="remove-subscription"]`,
    lastUpdate: `${flSelector} .last-update`,
    tooltip: `${flSelector} [type="tooltip"]`
  };
}

export async function getTooltipMsg(tooltipSelector) {
  try {
    await clickOnDisplayedElement(tooltipSelector, { timeout: 1000 });
  } catch (err) {
    if (err.name === "TimeoutError") {
      return;
    }
    throw err;
  }

  const tooltipMsgElem = await getDisplayedElement(
    `${tooltipSelector} [role="tooltip"]`
  );
  return await tooltipMsgElem.getText();
}

async function getActualFilterListsInfo() {
  const allFLRowsSelector = "#all-filter-lists-table [aria-label]";

  const info = [];
  for (const flElem of await driver.findElements(By.css(allFLRowsSelector))) {
    const actualName = await flElem.getAttribute("aria-label");
    const { tooltip, lastUpdate } = getFLSelectors(actualName);

    let lastUpdatedTxt;
    try {
      const lastUpdatedElem = await getDisplayedElement(lastUpdate);
      lastUpdatedTxt = await lastUpdatedElem.getText();
    } catch (e) {} // lastUpdatedElem doesn't exist

    const tooltipMsg = await getTooltipMsg(tooltip);

    info.push({ actualName, lastUpdatedTxt, tooltipMsg });
  }

  return info;
}

export async function manageFilterListsError(err) {
  if (err.name === "TimeoutError") {
    const info = await getActualFilterListsInfo();
    err.message = `${err.message}\nActual filter lists:\n${JSON.stringify(info, null, 2)}`;
  }

  throw err;
}

export async function checkSubscriptionsState(
  filterlists,
  { timeout = 3000, regexp = /(Just now|minutes ago)/, refresh = false } = {}
) {
  await initOptionsAdvancedTab(getOptionsHandle());

  let lastWaitError;
  try {
    await wait(
      async () => {
        if (refresh) {
          await driver.navigate().refresh();
          await initOptionsAdvancedTab(getOptionsHandle());
        }

        try {
          const actualSubs = [];
          const expectedSubs = [];
          for (const { name, enabled } of filterlists) {
            expectedSubs.push({
              name,
              enabled,
              lastUpdated: expect.stringMatching(regexp)
            });

            const { filterlist, toggle, lastUpdate } = getFLSelectors(name);
            // FLs sometimes take time to properly load
            await getDisplayedElement(filterlist, { timeout: 4000 });
            const flEnabled = await isCheckboxPropertyEnabled(toggle);
            const lastUpdatedElem = await getDisplayedElement(lastUpdate, {
              timeout: 800
            });
            const lastUpdatedTxt = await lastUpdatedElem.getText();
            actualSubs.push({
              name,
              enabled: flEnabled,
              lastUpdated: lastUpdatedTxt
            });
          }

          expect(actualSubs).toEqual(expectedSubs);
          return true;
        } catch (e) {
          lastWaitError = e;
        }
      },
      timeout,
      "Unexpected filter lists state",
      500
    );
  } catch (err) {
    err.message = `${err.message}:\n${lastWaitError.message}`;
    throw err;
  }
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
  const timeout = 7000;
  const { filterlist } = getFLSelectors(langName, { isOptionsGeneralTab });
  if (isAdded) {
    try {
      await getDisplayedElement(filterlist, { timeout });
    } catch (err) {
      console.warn(
        "Language filterlist not shown, reloading the page as a workaround"
      );
      await driver.navigate().refresh();
      await getDisplayedElement(filterlist, {
        timeout: 15000,
        forceRefresh: false
      });
    }
  } else {
    await waitForNotDisplayed(filterlist, { timeout });
  }
  return filterlist;
}

export async function addLanguageFilterList(
  langName,
  { isOptionsGeneralTab = true, isLanguagesPopupOpen = false } = {}
) {
  const errText = isOptionsGeneralTab ? "languages box" : "filters box";
  let langElem;
  await wait(
    async () => {
      const languageElems = isLanguagesPopupOpen
        ? await getPopupLanguageFilterLists(isOptionsGeneralTab)
        : await getLanguageFilterLists(isOptionsGeneralTab);

      for (const elem of languageElems) {
        const text = await getElemTextSafe(elem);
        if (text && text.startsWith(langName)) {
          langElem = elem;
          return true;
        }
      }
      if (!langElem) {
        throw new Error();
      }
    },
    2000,
    `${langName} EasyList was not found on ${errText}`
  );

  await clickOnDisplayedElement(langElem);
  await checkLanguageFilterList(langName, { isOptionsGeneralTab });
}

export async function removeLanguageFilterList(
  langName,
  { isOptionsGeneralTab = true } = {}
) {
  const { filterlist, trashBtn } = getFLSelectors(langName, {
    isOptionsGeneralTab
  });
  await clickOnDisplayedElement(trashBtn);
  await waitForNotDisplayed(filterlist, { timeout: 3000 });
}

export async function changeLanguageFilterList(langNameBefore, langNameAfter) {
  const isOptionsGeneralTab = true;
  const flSelector = await checkLanguageFilterList(langNameBefore, {
    isAdded: true,
    isOptionsGeneralTab
  });

  const dataActionSelector = '[data-action="open-languages-box"]';
  // Initially the "change" selector locates also the expected language
  let changeFilterlistSelector = `${flSelector} ${dataActionSelector}`;

  // For some reason right after extension installation the changed filterlist
  // may be different than the one that got clicked. Retrying as a workaround
  await wait(
    async () => {
      // Open the languages popup using the "change" button
      await clickOnDisplayedElement(changeFilterlistSelector, {
        scrollIntoView: true
      });
      try {
        await addLanguageFilterList(langNameAfter, {
          isOptionsGeneralTab,
          isLanguagesPopupOpen: true
        });
        return true;
      } catch (err) {
        if (err.name === "TimeoutError") {
          console.warn(`${err.message}, retrying...`);
          // At this point the language has changed, but it's likely a wrong one,
          // that's why the selector is now less strict
          changeFilterlistSelector = dataActionSelector;
          return false;
        }
        throw err;
      }
    },
    3000,
    `Language filterlist "${langNameBefore}" could not be changed to "${langNameAfter}"`
  );

  // Check langNameBefore list has been removed
  await checkLanguageFilterList(langNameBefore, {
    isAdded: false,
    isOptionsGeneralTab
  });
}

export async function isFLInCorrectState(name, expectedState) {
  const allSubscriptions = await driver.executeScript(() => {
    return browser.runtime.sendMessage({
      type: "subscriptions.get"
    });
  });

  let targetFilterList = null;
  for (const key in allSubscriptions) {
    if (Object.prototype.hasOwnProperty.call(allSubscriptions, key)) {
      const subscription = allSubscriptions[key];
      if (subscription.title === name) {
        targetFilterList = subscription;
        break;
      }
    }
  }

  if (!targetFilterList) {
    return false;
  }

  const currentEnabledState = !targetFilterList.disabled;
  if (currentEnabledState === expectedState.enable) {
    return true;
  }
  return false;
}

export async function clickFLAndCheck(
  name,
  { enable = true, timeout = 2000, stepsAfterClick = () => {} } = {}
) {
  const checkboxSelector = `[aria-label="${name}"] button`;
  const enabledBeforeClick = !enable;

  const enabled = await isCheckboxAttributeEnabled(checkboxSelector);
  // If the filterlist is already in the desired state, return indicating it
  // has not been clicked
  if (enabled === enable) {
    return false;
  }

  expect({ name, enabledBeforeClick: enabled }).toEqual({
    name,
    enabledBeforeClick
  });

  await clickOnDisplayedElement(checkboxSelector);
  await stepsAfterClick(enable);
  await waitForCheckboxStatus(checkboxSelector, {
    timeout,
    expectEnabled: enable,
    isProperty: false,
    name
  });

  return true;
}

export async function setPremiumFLsDefaultState() {
  await initOptionsGeneralTab(getOptionsHandle());

  for (const { name, enabled, stepsAfterClick } of premiumFilterLists) {
    const isAlreadyCorrect = await isFLInCorrectState(name, {
      enable: enabled
    });

    if (!isAlreadyCorrect) {
      await clickFLAndCheck(name, { enable: enabled, stepsAfterClick });
    }
  }
}

export async function sendExtCommandInTrustedIframe(
  trustedIframeHandle,
  method,
  params
) {
  const currentHandle = await driver.getWindowHandle();
  await driver.switchTo().frame(trustedIframeHandle);

  // make sure the public API is available
  await driver.wait(
    async () => {
      return await driver.executeScript(() => {
        return typeof window.sendExtCommand === "function";
      });
    },
    5000,
    "Timeout waiting for public API to be available"
  );

  const responses = await driver.executeAsyncScript(
    async (m, p, callback) => {
      // eslint-disable-next-line no-undef
      const result = await sendExtCommand({ method: m, params: p });
      callback(result);
    },
    method,
    params
  );
  await driver.switchTo().window(currentHandle);
  return responses;
}

export function callOptionsAPI(apiPath, ...params) {
  return _callOptionsAPI(initOptionsGeneralTab, apiPath, ...params);
}

export async function loadPageWithTrustedIframe(pageUrl, trustedIframeSrc) {
  await openNewTab(pageUrl);

  // Handle the cookie popup if it appears
  try {
    const acceptButton = await driver.wait(
      until.elementLocated(By.css('button[aria-label="Consent"]')),
      5000
    );
    await driver.wait(until.elementIsVisible(acceptButton), 5000);
    await acceptButton.click();
  } catch (e) {}

  // Inject the iframe in the page and wait for it to load
  await driver.executeAsyncScript((iframeSrc, done) => {
    const iframe = document.createElement("iframe");
    const timeout = setTimeout(
      () => done(new Error("Iframe load timed out")),
      10000
    );

    const finish = (result) => {
      clearTimeout(timeout);
      done(result);
    };

    iframe.onload = () => finish();
    iframe.onerror = () => finish(new Error("Iframe failed to load"));
    iframe.src = iframeSrc;
    document.body.appendChild(iframe);
  }, trustedIframeSrc);

  // Wait for the injected trusted iframe to be present and visible
  const iframeSelector = `iframe[src="${trustedIframeSrc}"]`;
  try {
    const iframeElement = await driver.findElement(By.css(iframeSelector));
    await driver.wait(
      until.elementIsVisible(iframeElement),
      15000,
      `Timeout waiting for injected iframe with src ${trustedIframeSrc} to be visible on ${pageUrl}.`
    );
  } catch (e) {
    throw new Error(
      `Injected trusted iframe with src "${trustedIframeSrc}" not found or not visible on ${pageUrl}. Original error: ${e.message}`
    );
  }

  // Switch to the iframe
  const trustedIframe = await driver.findElement(By.css(iframeSelector));
  return trustedIframe;
}
