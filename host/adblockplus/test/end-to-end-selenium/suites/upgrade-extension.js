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
import { aaTestPageUrl } from "@eyeo/test-utils/urls";
import {
  getOptionsHandle,
  upgradeExtension,
  blockAds
} from "@eyeo/test-utils/extension";
import { customBlockingFilter } from "@eyeo/test-utils/filters";

import {
  enablePremiumProgrammatically,
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  changeLanguageFilterList,
  addCustomFilters,
  getCustomFilters,
  deleteCustomFilters,
  setPausedStateFromPopup,
  getPopupBlockedAdsTotalCount,
  clickFLCheckboxAndCheck
} from "../utils/page.js";

async function clickFLAndCheck(
  name,
  { enable = true, timeout = 1000, stepsAfterClick = () => {} } = {}
) {
  const checkboxSelector = `[aria-label="${name}"] button`;
  const enabledBeforeClick = !enable;

  const enabled = await isCheckboxAttributeEnabled(checkboxSelector);
  expect({ name, enabledBeforeClick: enabled }).toEqual({
    name,
    enabledBeforeClick
  });

  await clickOnDisplayedElement(checkboxSelector);
  await stepsAfterClick();
  await waitForCheckboxStatus(checkboxSelector, {
    timeout,
    expectEnabled: enable,
    isProperty: false,
    name
  });
}

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
    expectEnabled: enable,
    isProperty: false,
    name
  });
}

export default () => {
  it("keeps settings after upgrade", async function () {
    // https://eyeo.atlassian.net/browse/EXT-153
    if (browserDetails.browserName === "edge") this.skip();

    this.timeout(100000); // Long test with many checks, including the extension reload

    const maxAdsBlocked = 15;

    // activate premium
    await enablePremiumProgrammatically();

    // Change default filterlist status:
    // cookies (premium), additional tracking, acceptable ads, german easylist
    await clickFLAndCheck("Block cookie consent pop-ups", {
      enable: true,
      stepsAfterClick: async () =>
        clickOnDisplayedElement("button[data-action='add-subscription']")
    });
    await clickFLAndCheck("Block additional tracking", {
      timeout: 2000,
      enable: true
    });
    const aaSelector = "#acceptable-ads-allow";
    await clickFLCheckboxAndCheck(aaSelector, {
      enable: false,
      name: "Acceptable Ads"
    });
    // Replace default EasyList with German Easylist
    await changeLanguageFilterList("English", "Deutsch + English");

    // turn off the counter on the extension icon
    await clickAdsCounterAndCheck({ enable: false });

    // Add custom filter. Needs to be added before blocking ads
    await addCustomFilters([customBlockingFilter]);

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
    await upgradeExtension(initOptionsGeneralTab);

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

    const generalTabFilterLists = [
      "Block cookie consent pop-ups",
      "Enhanced distraction control",
      "Block additional tracking"
    ];
    for (const name of generalTabFilterLists) {
      await clickFLAndCheck(name, { enable: false });
    }

    // check if AA is still disabled and can be enabled
    await clickFLCheckboxAndCheck(aaSelector, {
      enable: true,
      name: "Acceptable Ads"
    });

    // Replace German EasyList with Italian Easylist
    await changeLanguageFilterList("Deutsch + English", "italiano + English");

    // check if the counter on the extension icon is still off and turn it on
    await clickAdsCounterAndCheck({ enable: true });

    // check if custom filters are still there and can be changed
    expect(await getCustomFilters()).toContain(customBlockingFilter);
    await deleteCustomFilters();
    expect(await getCustomFilters()).not.toContain(customBlockingFilter);
  });
};
