/* eslint-disable no-await-in-loop */
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

import { expect } from "expect";
import { By } from "selenium-webdriver";

import {
  getDisplayedElement,
  isCheckboxEnabled,
  openNewTab,
  waitForNotDisplayed,
  clickOnDisplayedElement,
} from "@eyeo/test-utils/driver";
import { blockHideLocalhostUrl, aaTestPageUrl } from "@eyeo/test-utils/urls";
import { getOptionsHandle, upgradeExtension } from "@eyeo/test-utils/extension";

import {
  initOptionsGeneralTab,
  initOptionsFiltersTab,
  waitForSubscribed,
  setPausedStateFromPopup,
  initOptionsCustomizeTab,
  getPopupBlockedAdsTotalCount,
  getSubscriptionInfo,
  setCustomFilters,
  enablePremiumProgrammatically,
  initOptionsPremiumFlTab,
  getCustomFilters,
  waitForAdsBlockedToBeInRange,
  expectAAEnabled,
} from "../utils/page.js";
import {
  getDefaultFilterLists,
  premiumFilterLists,
  languageFilterLists,
} from "../utils/dataset.js";

async function blockAds(expectedMinBlocked, expectedMaxBlocked) {
  const timeout = 8000;

  let errorMessage;
  let adsBlocked;
  try {
    // under certain conditions the ads are not being blocked after loading blockHideUrl,
    // so we have to retry until ads are blocked
    await driver.wait(async () => {
      await openNewTab(blockHideLocalhostUrl);
      try {
        adsBlocked = await waitForAdsBlockedToBeInRange(expectedMinBlocked, expectedMaxBlocked);
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

export default () => {
  it("keeps settings after upgrade", async function () {
    this.timeout(100000); // Long test with many checks, including the extension reload

    const customBlockingFilter = "localhost*js/test-script.js";
    const maxAdsBlocked = 15;

    // activate premium
    await enablePremiumProgrammatically();

    // enable premium filterlists
    await initOptionsPremiumFlTab(getOptionsHandle());
    for (const list of premiumFilterLists) {
      await clickOnDisplayedElement(`span:has(> #${list.inputId})`);
      await driver.wait(isCheckboxEnabled(list.inputId), 2000, `${list.text} is not enabled`);
    }

    // turn off the counter on the extension icon
    await initOptionsGeneralTab(getOptionsHandle());
    await clickOnDisplayedElement("span:has(> #prefs__show_statsinicon)");
    await driver.wait(
      async () => {
        return !(await isCheckboxEnabled("prefs__show_statsinicon"));
      },
      2000,
      "Counter on the extension icon is still on",
    );

    // acceptable ads (off), easyList (off), easyprivacy (on)
    await initOptionsFiltersTab(getOptionsHandle());
    const lists = getDefaultFilterLists(expectAAEnabled).filter((list) =>
      ["easyprivacy", "acceptable_ads", "easylist"].includes(list.name),
    );
    for (const list of lists) {
      // Easyprivacy is down below the page, therefore scrollIntoView is needed
      await clickOnDisplayedElement(`span:has(> #${list.inputId})`, { scrollIntoView: true });

      if (list.enabled) {
        // if list is enabled by default, it should be unsubscribed
        await driver.wait(
          async () => {
            return (await getSubscriptionInfo(list.name)) === "Unsubscribed.";
          },
          2000,
          `${list.text} is still subscribed`,
        );
      } else {
        // if list is disabled by default, it should be subscribed
        await waitForSubscribed(list.name, list.inputId);
      }
    }

    // note: we need easylist to be off, otherwise there is no enough space for all the filters (MV3)
    // subscribe to German + English filterlist
    const langList = languageFilterLists.find((list) => list.name === "easylist_plus_german");
    await getDisplayedElement("#language_select");
    await driver.findElement(By.css(`#language_select > option[value="${langList.name}"]`)).click();
    await driver.wait(isCheckboxEnabled(langList.inputId), 2000, `${langList.text} is not enabled`);
    await waitForSubscribed(langList.name, langList.inputId);

    // Add custom filter. Needs to be added before blocking ads
    await initOptionsCustomizeTab(getOptionsHandle());
    await setCustomFilters([customBlockingFilter], true);

    // ads should be blocked before the domain is allowlisted
    const blockedBeforeUpgrade = await blockAds(0, maxAdsBlocked);

    // allowlist the page
    // The URL used here cannot be localTestPageUrl because it interferes with
    // getPopupBlockedAdsTotalCount, which uses it
    await setPausedStateFromPopup(aaTestPageUrl, true);

    // upgrade extension
    const prevExtVersion = extension.version;
    await upgradeExtension(initOptionsGeneralTab);

    // check the extension version has changed
    expect(extension.version).not.toEqual(prevExtVersion);

    // check if the page is still allowlisted and can be changed
    // allowlist has to be removed before we continue blocking ads
    await setPausedStateFromPopup(aaTestPageUrl, false);

    // check blocked ads count is kept after upgrade
    expect(await getPopupBlockedAdsTotalCount()).toBeGreaterThanOrEqual(blockedBeforeUpgrade);

    // check if blocked ads are still increasing
    await blockAds(blockedBeforeUpgrade, maxAdsBlocked);

    // check if premium filterlists are still enabled and can be changed
    await initOptionsPremiumFlTab(getOptionsHandle());
    for (const list of premiumFilterLists) {
      await clickOnDisplayedElement(`span:has(> #${list.inputId})`);
      await driver.wait(
        async () => {
          return !(await isCheckboxEnabled(list.inputId));
        },
        2000,
        `${list.text} is still enabled`,
      );
    }

    // check if the counter on the extension icon is still off
    await initOptionsGeneralTab(getOptionsHandle());
    await clickOnDisplayedElement("span:has(> #prefs__show_statsinicon)");
    await driver.wait(
      isCheckboxEnabled("prefs__show_statsinicon"),
      2000,
      "Counter on the extension icon is still off",
    );

    // check if German + English filterlist is still subscribed
    await initOptionsFiltersTab(getOptionsHandle());
    await clickOnDisplayedElement(`span:has(> #${langList.inputId})`);
    await waitForNotDisplayed(`span:has(> #${langList.inputId})`);

    // acceptable ads (on), easylist (on), easyprivacy (off)
    for (const list of lists) {
      await clickOnDisplayedElement(`span:has(> #${list.inputId})`, { scrollIntoView: true });

      if (list.enabled) {
        // if list is enabled by default, it should be subscribed
        await waitForSubscribed(list.name, list.inputId);
      } else {
        // if list is disabled by default, it should be unsubscribed
        await driver.wait(
          async () => {
            return (await getSubscriptionInfo(list.name)) === "Unsubscribed.";
          },
          2000,
          `${list.text} is still subscribed`,
        );
      }

      // checkbox should equal to the default value
      expect(await isCheckboxEnabled(list.inputId)).toEqual(list.enabled);
    }

    // check if custom filters are still there and can be changed
    await initOptionsCustomizeTab(getOptionsHandle());
    let customFilters;
    await driver.wait(
      async () => {
        customFilters = await getCustomFilters();
        return customFilters[0] !== "";
      },
      5000,
      "Custom filters were empty",
    );
    expect(customFilters).toContain(customBlockingFilter);

    // check if custom filters can be changed
    await setCustomFilters([]);
    expect(await getCustomFilters()).not.toContain(customBlockingFilter);
  });
};
