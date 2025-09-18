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

import {
  isCheckboxAttributeEnabled,
  clickOnDisplayedElement,
  waitForCheckboxStatus
} from "@eyeo/test-utils/driver";
import { aaTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  getOptionsHandle,
  upgradeExtension,
  blockAds
} from "@eyeo/test-utils/extension";
import { customBlockingFilter } from "@eyeo/test-utils/host-filters";

import {
  isPremiumLabelPresent,
  enablePremiumProgrammatically,
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  changeLanguageFilterList,
  addCustomFilters,
  getCustomFilters,
  clickOnCustomFilterToggleAndCheck,
  setPausedStateFromPopup,
  getPopupBlockedAdsTotalCount,
  clickFLCheckboxAndCheck,
  clickFLAndCheck
} from "../utils/page.js";
import { premiumFilterLists, freeFilterLists } from "../utils/dataset.js";

async function clickAdsCounterAndCheck({ enable = true } = {}) {
  const adsCounterCheckboxSelector =
    '#customize [data-pref="show_statsinicon"] button';
  const name = "Ads Counter";
  const enabledBeforeClick = !enable;

  await initOptionsAdvancedTab(getOptionsHandle());
  const enabled = await isCheckboxAttributeEnabled(adsCounterCheckboxSelector);
  expect({ name, enabledBeforeClick: enabled }).toEqual({
    name,
    enabledBeforeClick
  });

  await clickOnDisplayedElement(adsCounterCheckboxSelector);
  await waitForCheckboxStatus(adsCounterCheckboxSelector, {
    timeout: 3000,
    expectEnabled: enable,
    isProperty: false,
    name
  });
}

export default () => {
  it("keeps settings after upgrade", async function () {
    this.timeout(100000); // Long test with many checks, including the extension reload

    const maxAdsBlocked = 15;
    const isPremium = await isPremiumLabelPresent();

    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await initOptionsGeneralTab(getOptionsHandle(), {
      waitForDefaultState: true
    });

    // Change default filterlist status:
    // cookies (premium), social media tracking, acceptable ads, english easylist
    const generalTabFilterLists = [...premiumFilterLists, ...freeFilterLists];
    for (const { name, enabled, stepsAfterClick } of generalTabFilterLists) {
      if (!enabled) {
        continue; // Don't disable filterlists enabled by default
      }

      await clickFLAndCheck(name, { enable: true, stepsAfterClick });
    }
    const aaSelector = "#acceptable-ads-allow";
    await clickFLCheckboxAndCheck(aaSelector, {
      enable: false,
      name: "Acceptable Ads"
    });
    const defaultLangName = "English";
    const changedLangName1 = "Deutsch + English";
    const changedLangName2 = "italiano + English";
    await changeLanguageFilterList(defaultLangName, changedLangName1);

    // turn off the counter on the extension icon
    await clickAdsCounterAndCheck({ enable: false });

    // Add custom filter. Needs to be added before blocking ads
    await addCustomFilters([customBlockingFilter], {
      switchToAdvancedTab: true
    });

    // ads should be blocked before the domain is allowlisted
    const blockedBeforeUpgrade = await blockAds(
      0,
      maxAdsBlocked,
      getPopupBlockedAdsTotalCount
    );

    // allowlist a page
    // The URL used here cannot be localTestPageUrl because it interferes with
    // getPopupBlockedAdsTotalCount, which uses it
    await setPausedStateFromPopup(aaTestPageUrl, true);

    // upgrade extension
    const prevExtVersion = extension.version;
    await upgradeExtension(initOptionsGeneralTab, {
      waitForDefaultState: false
    });

    // check the extension version has changed
    expect(extension.version).not.toEqual(prevExtVersion);

    // check if the page is still allowlisted and can be changed
    // allowlist has to be removed before we continue blocking ads
    await setPausedStateFromPopup(aaTestPageUrl, false);

    // check blocked ads count is kept after upgrade
    const blockedAfterUpgrade = await getPopupBlockedAdsTotalCount();
    expect(blockedAfterUpgrade).toBeGreaterThanOrEqual(blockedBeforeUpgrade);

    // check if blocked ads are still increasing
    await blockAds(
      blockedBeforeUpgrade,
      maxAdsBlocked,
      getPopupBlockedAdsTotalCount
    );

    // check if general tab filterlists are still enabled and can be changed
    await initOptionsGeneralTab(getOptionsHandle());
    for (const { name, stepsAfterClick } of generalTabFilterLists) {
      await clickFLAndCheck(name, { enable: false, stepsAfterClick });
    }

    // check if AA is still disabled and can be enabled
    await clickFLCheckboxAndCheck(aaSelector, {
      enable: true,
      name: "Acceptable Ads"
    });

    // check if language filter list can be changed again
    await changeLanguageFilterList(changedLangName1, changedLangName2);

    // check if the counter on the extension icon is still off and turn it on
    await clickAdsCounterAndCheck({ enable: true });

    // check if custom filters are still there and can be changed
    expect(await getCustomFilters({ switchToAdvancedTab: true })).toContain(
      customBlockingFilter
    );
    await clickOnCustomFilterToggleAndCheck(customBlockingFilter, {
      enable: false
    });
  });
};
