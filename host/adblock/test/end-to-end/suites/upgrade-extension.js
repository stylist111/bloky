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
  isCheckboxPropertyEnabled,
  waitForNotDisplayed,
  clickOnDisplayedElement,
  wait,
} from "@eyeo/test-utils/driver";
import { aaTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  getOptionsHandle,
  upgradeExtension,
  addFiltersProgrammatically,
  getFiltersProgrammatically,
  blockAds,
} from "@eyeo/test-utils/extension";
import { customBlockingFilter } from "@eyeo/test-utils/host-filters";

import {
  initOptionsGeneralTab,
  initOptionsFiltersTab,
  setPausedStateFromPopup,
  initOptionsCustomizeTab,
  getPopupBlockedAdsTotalCount,
  setCustomFilters,
  enablePremiumProgrammatically,
  initOptionsPremiumFlTab,
  getCustomFilters,
  checkSubscriptionsState,
  changePremiumFLStatus,
} from "../utils/page.js";
import { defaultFilterLists, premiumFilterLists, languageFilterLists } from "../utils/dataset.js";

export default () => {
  before(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
  });

  it("keeps settings after upgrade", async function () {
    this.timeout(100000); // Long test with many checks, including the extension reload

    const maxAdsBlocked = 15;
    const prevExtVersion = extension.version;

    // activate premium
    await enablePremiumProgrammatically();

    // enable premium filterlist
    await initOptionsPremiumFlTab(getOptionsHandle());
    const { checkboxSelector: premiumFlCheckboxSelector } = premiumFilterLists[0];
    await changePremiumFLStatus(premiumFlCheckboxSelector, { enable: true });

    // turn off the counter on the extension icon
    await initOptionsGeneralTab(getOptionsHandle());
    await clickOnDisplayedElement("span:has(> #prefs__show_statsinicon)");
    await wait(
      async () => {
        return !(await isCheckboxPropertyEnabled("#prefs__show_statsinicon"));
      },
      2000,
      "Counter on the extension icon is still on",
    );

    // switch existing default states for lists: acceptable ads, easyList
    await initOptionsFiltersTab(getOptionsHandle());
    const defaultFLSubset = defaultFilterLists.filter((list) =>
      ["acceptable_ads", "easylist"].includes(list.name),
    );

    for (const { checkboxSelector, enabled, name } of defaultFLSubset) {
      await clickOnDisplayedElement(`span:has(> ${checkboxSelector})`);
      // if list is enabled by default, it should be unsubscribed
      const regexp = enabled ? /Unsubscribed/ : /updated|Subscribed/;
      await checkSubscriptionsState([{ name, enabled: !enabled, checkboxSelector }], {
        timeout: 4000,
        regexp,
      });
    }

    // note: we need easylist to be off, otherwise there is no enough space for all the filters (MV3)
    // subscribe to German + English filterlist
    const langList = languageFilterLists.find((list) => list.name === "easylist_plus_german");
    await getDisplayedElement("#language_select");
    await driver.findElement(By.css(`#language_select > option[value="${langList.name}"]`)).click();
    await checkSubscriptionsState([{ ...langList, enabled: true }], {
      regexp: /updated|Subscribed/,
    });

    // Add custom filter. Needs to be added before blocking ads
    await initOptionsCustomizeTab(getOptionsHandle());

    await addFiltersProgrammatically(initOptionsFiltersTab, customBlockingFilter);
    expect(await getFiltersProgrammatically(initOptionsFiltersTab)).toContain(customBlockingFilter);

    // ads should be blocked before the domain is allowlisted
    const blockedBeforeUpgrade = await blockAds(0, maxAdsBlocked, getPopupBlockedAdsTotalCount);

    // allowlist the page
    // The URL used here cannot be localTestPageUrl because it interferes with
    // getPopupBlockedAdsTotalCount, which uses it
    await setPausedStateFromPopup(aaTestPageUrl, true);

    // upgrade extension
    await upgradeExtension(initOptionsGeneralTab);

    // check the extension version has changed
    expect(extension.version).not.toEqual(prevExtVersion);

    // check if the page is still allowlisted and can be changed
    // allowlist has to be removed before we continue blocking ads
    await setPausedStateFromPopup(aaTestPageUrl, false);

    // check blocked ads count is kept after upgrade
    expect(await getPopupBlockedAdsTotalCount()).toBeGreaterThanOrEqual(blockedBeforeUpgrade);

    // check if blocked ads are still increasing
    await blockAds(blockedBeforeUpgrade, maxAdsBlocked, getPopupBlockedAdsTotalCount);

    // check if premium filterlist is still enabled and can be disabled
    await initOptionsPremiumFlTab(getOptionsHandle());
    await changePremiumFLStatus(premiumFlCheckboxSelector, { enable: false });

    // check if the counter on the extension icon is still off
    await initOptionsGeneralTab(getOptionsHandle());
    await clickOnDisplayedElement("span:has(> #prefs__show_statsinicon)");
    await wait(
      async () => isCheckboxPropertyEnabled("#prefs__show_statsinicon"),
      2000,
      "Counter on the extension icon is still off",
    );

    // check if German + English filterlist is still subscribed
    await initOptionsFiltersTab(getOptionsHandle());
    await clickOnDisplayedElement(`span:has(> ${langList.checkboxSelector})`);
    await waitForNotDisplayed(`span:has(> ${langList.checkboxSelector})`);

    // switch back to the existing default states for lists: acceptable ads, easyList
    for (const { name, enabled, checkboxSelector } of defaultFLSubset) {
      await clickOnDisplayedElement(`span:has(> ${checkboxSelector})`, {
        scrollIntoView: true,
      });

      // if list is enabled by default, it should be subscribed
      const regexp = enabled ? /updated|Subscribed/ : /Unsubscribed/;
      await checkSubscriptionsState([{ name, enabled, checkboxSelector }], { regexp });
    }

    // check if custom filters are still there and can be changed
    await initOptionsCustomizeTab(getOptionsHandle());
    let customFilters;
    await wait(
      async () => {
        customFilters = await getCustomFilters();
        return customFilters.length > 0;
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
