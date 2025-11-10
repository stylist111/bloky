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

import { By, Key, until } from "selenium-webdriver";
import { expect } from "expect";

import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  getDisplayedElement,
  openNewTab,
  findUrl,
  waitForNotNullProperty,
  isCheckboxPropertyEnabled,
  waitForCheckboxStatus,
  waitForNotDisplayed,
  clickAndCloseNewTab,
  getTabId,
  clickOnDisplayedElement,
  wait,
} from "@eyeo/test-utils/driver";
import { simulatePremiumActivation, simulateDowngradeToFreeUser } from "@eyeo/test-utils/account";
import { getOptionsHandle } from "@eyeo/test-utils/extension";
import { premiumFilterLists } from "./dataset.js";

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

  await wait(
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
  await wait(
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
  await waitForNotNullProperty("#acceptable_ads", "checked", { timeout: 2000 });
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

export async function initOptionsPremiumFlTab(optionsHandle) {
  await loadOptionsTab(optionsHandle, "premium-filters");
  await getDisplayedElement("#premium-filter-lists > div:nth-child(2)", {
    timeout: 7000,
    // Right after initialisation not all premium filterlists may show up
    // Refreshing as a workaround
    forceRefresh: true,
  });
}

export async function getCustomFilters() {
  const filters = await waitForNotNullProperty("#txtFiltersAdvanced", "value", { timeout: 2000 });
  return filters
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function setCustomFilters(filters, append = false) {
  await initOptionsCustomizeTab(getOptionsHandle());
  const editButton = await getDisplayedElement("#btnEditAdvancedFilters", { timeout: 2000 });
  // The edit button functionality may take some time to be ready.
  // Retrying as a workaround
  let saveButton;
  await wait(
    async () => {
      try {
        await editButton.click();
        saveButton = await getDisplayedElement("#btnSaveAdvancedFilters");
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
  await wait(
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

// This function assumes initOptionsFiltersTab() being called beforehand
export async function clickFilterlist(name, checkboxSelector, enabledAfterClick) {
  await clickOnDisplayedElement(`[name="${name}"]`);

  // Language filter lists get removed from the UI after disabling them.
  // In that case no further checks are done here
  if (!checkboxSelector) {
    return;
  }

  const text = enabledAfterClick ? "enabled" : "disabled";
  await wait(
    async () => {
      return (await isCheckboxPropertyEnabled(checkboxSelector)) === enabledAfterClick;
    },
    1000,
    `The filterlist "${name}" was not ${text} after clicking`,
  );
}

async function clickCheckboxAndCheck(checkboxSelector, { enable = true, name }) {
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: !enable,
    name,
  });

  await clickOnDisplayedElement(checkboxSelector);
  await waitForCheckboxStatus(checkboxSelector, {
    expectEnabled: enable,
    name,
  });
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
    `filters were not applied on page when expectAllowlisted=${expectAllowlisted}`,
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

export async function checkPremiumPageHeader(ctaTextSelector, ctaLinkSelector, premiumURL) {
  // sometimes the elements are displayed with a delay
  const ctaText = await getDisplayedElement(ctaTextSelector, { timeout: 4000 });
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

export async function setMarketingOptOutState(optOut) {
  const checkboxSelector = "#prefs__marketing_opt_out";

  await initOptionsGeneralTab(getOptionsHandle());
  const isChecked = await isCheckboxPropertyEnabled(checkboxSelector);
  if (optOut !== isChecked) {
    return;
  }

  await clickCheckboxAndCheck(checkboxSelector, {
    enable: !optOut,
    name: "Marketing opt-out",
  });
}

export async function changePremiumFLStatus(checkboxSelector, { enable = true } = {}) {
  await clickOnDisplayedElement(`span:has(> ${checkboxSelector})`, { timeout: 1500 });

  const errMsg = enable ? "enabled" : "disabled";
  await wait(
    async () => {
      return (await isCheckboxPropertyEnabled(checkboxSelector)) === enable;
    },
    2000,
    `${checkboxSelector} has not been ${errMsg}`,
  );
}

export async function setPremiumFLsDefaultState() {
  await initOptionsPremiumFlTab(getOptionsHandle());

  for (const { checkboxSelector } of premiumFilterLists) {
    if (await isCheckboxPropertyEnabled(checkboxSelector)) {
      await changePremiumFLStatus(checkboxSelector, { enable: false });
    }
  }
}

export async function checkSubscriptionsState(
  filterlists,
  { timeout = 3000, regexp = /(right now|ago)/ } = {},
) {
  let lastWaitError;
  try {
    await wait(
      async () => {
        try {
          const actualSubs = [];
          const expectedSubs = [];
          for (const { name, enabled, checkboxSelector } of filterlists) {
            expectedSubs.push({ name, enabled, lastUpdated: expect.stringMatching(regexp) });

            const infoElem = await driver.findElement(
              By.css(`[name="${name}"] .subscription_info`),
            );
            const lastUpdated = await infoElem.getText();
            const flEnabled = await isCheckboxPropertyEnabled(checkboxSelector);
            actualSubs.push({ name, enabled: flEnabled, lastUpdated });
          }

          expect(actualSubs).toEqual(expectedSubs);
          return true;
        } catch (e) {
          lastWaitError = e;
        }
      },
      timeout,
      "Unexpected filter lists state",
      500,
    );
  } catch (err) {
    err.message = `${err.message}\n${lastWaitError.message}`;
    throw err;
  }
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
  try {
    await clickOnDisplayedElement(beforeClickBtn, {
      timeout: 5000,
      checkDisplayed: false, // Sometimes isDisplayed() returns false, even though the button can be clicked
    });
  } catch (err) {
    // If clicking fails, check if afterClickBtn is already present (already in desired state)
    try {
      await getDisplayedElement(afterClickBtn, { timeout: 2000, checkDisplayed: false });
      console.warn(
        `setPausedStateFromPopup: Already in desired state for url=${url}, paused=${paused}`,
      );
      await driver.close();
      await driver.switchTo().window(getOptionsHandle());
      return;
    } catch {
      // Not in desired state, rethrow original error
      throw err;
    }
  }

  // reopening the popup ccasionally fails when setPausedStateFromPopup is
  // called right after upgrading the extension. Retrying as a workaround
  await wait(
    async () => {
      await driver.switchTo().window(websiteHandle);
      await driver.navigate().refresh();
      try {
        await initPopupPage(tabId);
        return true;
      } catch (err) {
        console.warn(`after pausing/unpausing: ${err.message}, retrying...`);
      }
    },
    15000,
    "Could not init the popup page after pausing/unpausing",
  );

  // check paused state changed
  await getDisplayedElement(afterClickBtn, { timeout: 5000, checkDisplayed: false });
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
    { timeout: 2000 },
  );
  const totalCount = await elem.getText();

  await driver.switchTo().window(getOptionsHandle());

  return parseInt(totalCount, 10);
}

export async function isPremiumActivated() {
  try {
    await initOptionsPremiumTab(getOptionsHandle());

    const premiumStatus = await getDisplayedElement("#premium_status_msg", {
      timeout: 4000,
      forceRefresh: true,
    });

    const text = await premiumStatus.getText();
    if (text !== "ACTIVE") {
      return false;
    }
    await getDisplayedElement("#user-account-manage", { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function enablePremiumProgrammatically() {
  const portalUrl = "https://myaccount.getadblock.com";
  const applicationName = "ab-portal";
  await simulatePremiumActivation(portalUrl, applicationName, initOptionsGeneralTab);
}

export async function disablePremiumProgrammatically() {
  await simulateDowngradeToFreeUser(initOptionsGeneralTab);
}

export async function callUIExperimentsAPI(methodName, ...params) {
  const currentHandle = await driver.getWindowHandle();
  const optionsHandle = await getOptionsHandle();
  await driver.switchTo().window(optionsHandle);

  // wait for the ewe module to be available
  await driver.wait(
    async () => {
      const result = await driver.executeScript(() => {
        return !!window.modulesAsGlobal.ewe;
      });
      return result;
    },
    5000,
    "Timeout waiting for the ewe module to be available",
  );

  const experimentFlags = await driver.executeAsyncScript(
    async (method, args, callback) => {
      const result = await window.modulesAsGlobal.ewe.experiments[method](...args);
      callback(result);
    },
    methodName,
    params,
  );

  await driver.switchTo().window(currentHandle);
  return experimentFlags;
}

export async function sendExtCommandInTrustedIframe(trustedIframeHandle, method, params) {
  const currentHandle = await driver.getWindowHandle();
  await driver.switchTo().frame(trustedIframeHandle);

  // make sure the public API is available
  await driver.wait(
    async () => {
      const result = await driver.executeScript(() => {
        return !!window.sendExtCommand;
      });
      return result;
    },
    1000,
    "Timeout waiting for public API to be available",
  );

  const responses = await driver.executeAsyncScript(
    async (m, p, callback) => {
      const result = await window.sendExtCommand({ method: m, params: p });
      callback(result);
    },
    method,
    params,
  );
  await driver.switchTo().window(currentHandle);
  return responses;
}

export async function loadPageWithTrustedIframe(pageUrl, trustedIframeSrc) {
  await openNewTab(pageUrl);

  // The page sometimes fails to load and needs to be refreshed
  const bodyText = await driver.findElement(By.css("body")).getText();
  if (bodyText.includes("can't reach this page")) {
    await driver.sleep(3000);
    await driver.navigate().refresh();
  }

  // Handle the cookie popup if it appears
  try {
    const acceptButton = await driver.wait(
      until.elementLocated(By.css('button[aria-label="Consent"]')),
      5000,
    );
    await driver.wait(until.elementIsVisible(acceptButton), 5000);
    await acceptButton.click();
  } catch (e) {}

  // Inject the iframe in the page and wait for it to load
  await driver.executeAsyncScript((iframeSrc, done) => {
    const iframe = document.createElement("iframe");
    const timeout = setTimeout(() => done(new Error("Iframe load timed out")), 10000);

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
      `Timeout waiting for injected iframe with src ${trustedIframeSrc} to be visible on ${pageUrl}.`,
    );
  } catch (e) {
    throw new Error(
      `Injected trusted iframe with src "${trustedIframeSrc}" not found or not visible on ${pageUrl}. Original error: ${e.message}`,
    );
  }

  // Switch to the iframe
  const trustedIframe = await driver.findElement(By.css(iframeSelector));
  return trustedIframe;
}
