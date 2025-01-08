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
import moment from "moment";

import { localTestPageUrl } from "@eyeo/test-utils/urls";
import {
  getDisplayedElement,
  waitForNotDisplayed,
  isCheckboxEnabled,
  clickOnDisplayedElement,
  openNewTab,
  getTabId,
  waitForNotNullProperty
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

export const allowlistedWebsite = "testpages.eyeo.com";
export const snippetFilter =
  "testpages.eyeo.com#$#hide-if-contains 'filter not applied' p[id]";

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
      er: expect.stringMatching(/(^[a-zA-Z0-9]{8}|null)/), // experiments revision ID. Example: ietbCO3H
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
  await driver.wait(
    async () => {
      try {
        if (expectAllowlisted) {
          await getDisplayedElement("#script-id-full-path", {
            timeout,
            forceRefresh: false
          });
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
    await waitForNotDisplayed("#test-element-class", timeout);
    await waitForNotDisplayed("#test-element-id", timeout);
    await waitForNotDisplayed("#script-id-regex", timeout);
  }
}

async function loadOptionsTab(optionsHandle, id, timeout = 5000) {
  await driver.switchTo().window(optionsHandle);

  await driver.wait(
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

// This function assumes initOptionsGeneralTab() being called beforehand
export async function clickCheckbox(checkboxId, enabledAfterClick) {
  await clickOnDisplayedElement(`#${checkboxId}`);
  const text = enabledAfterClick ? "enabled" : "disabled";
  await driver.wait(
    async () => {
      return (await isCheckboxEnabled(checkboxId)) === enabledAfterClick;
    },
    1000,
    `The filterlist "${checkboxId}" was not ${text} after clicking`
  );
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
  timeout = 5000,
  waitForDefaultState = false
) {
  await loadOptionsTab(optionsHandle, "tab-general", timeout);
  await getDisplayedElement("#free-list-table", { timeout });
  if (waitForDefaultState) {
    await driver.wait(
      async () => waitForNotNullProperty("#acceptable-ads-allow", "checked"),
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
  const checkboxId = "acceptable-ads-allow";

  await initOptionsGeneralTab(getOptionsHandle());
  const aaEnabled = await isCheckboxEnabled(checkboxId);
  if (!aaEnabled) {
    await clickCheckbox(checkboxId, true);
  }
}

export async function setCustomFilters(filters) {
  await initOptionsAdvancedTab(getOptionsHandle());

  const customFiltersInput = await getDisplayedElement("#custom-filters input");

  for (const filter of filters) {
    await customFiltersInput.sendKeys(filter);
    await waitForNotDisplayed("#custom-filters button[disabled]");
    await clickOnDisplayedElement("#custom-filters button");
  }
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

export async function programaticallyAddFilters(filters) {
  const err = await driver.executeAsyncScript(
    async (filtersToAdd, callback) => {
      let errors = null;
      errors = await browser.runtime.sendMessage({
        type: "filters.importRaw",
        text: filtersToAdd
      });
      if (typeof errors != "undefined") errors = errors[0];
      // ABP changed the return of filters.importRaw to [errors, filterTexts]
      // https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/merge_requests/1064
      if (
        typeof errors != "undefined" &&
        errors[0] &&
        errors[0].constructor === Array
      )
        errors = errors[0];

      if (typeof errors != "undefined") callback(errors[0]);
      else callback();
    },
    filters
  );

  if (err) {
    throw new Error(err);
  }
}

export async function waitForAdsBlockedToBeInRange(min, max) {
  const timeout = 5000;

  let adsBlocked;
  try {
    await driver.wait(async () => {
      adsBlocked = await getPopupBlockedAdsTotalCount();
      return adsBlocked > min && adsBlocked <= max;
    }, timeout);
  } catch (err) {
    throw new Error(
      `Unexpected ads blocked count after ${timeout}ms. Expected: ${min} < value <= ${max}. Actual: ${adsBlocked}`
    );
  }
  return adsBlocked;
}

export async function checkPremiumActivated() {
  await driver.switchTo().window(getOptionsHandle());
  await driver.navigate().refresh();
  await initOptionsGeneralTab(getOptionsHandle());

  // Premium has been activated
  const premiumSelectors = [
    ".button.premium-label",
    ".premium-banner-container",
    'a[data-i18n="options_premium_manage"]'
  ];
  for (const selector of premiumSelectors) {
    await getDisplayedElement(selector);
  }
}

export async function enablePremiumProgrammatically() {
  await initOptionsGeneralTab(getOptionsHandle());

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
