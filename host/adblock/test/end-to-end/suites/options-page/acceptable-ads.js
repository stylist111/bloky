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
  isCheckboxEnabled,
  getDisplayedElement,
  clickOnDisplayedElement,
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import {
  initOptionsGeneralTab,
  initOptionsFiltersTab,
  setAADefaultState,
  expectAAEnabled,
} from "../../utils/page.js";

export default () => {
  after(async function () {
    await setAADefaultState();
  });

  it("displays AA default state", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await driver.wait(
      async () => {
        const aaEnabled = await isCheckboxEnabled("#acceptable_ads");
        return aaEnabled === expectAAEnabled;
      },
      5000,
      `Acceptable Ads is not in the default state. Expected state: ${expectAAEnabled}`,
    );
    const aaPrivacyEnabled = await isCheckboxEnabled("#acceptable_ads_privacy");
    expect(aaPrivacyEnabled).toEqual(false);

    await initOptionsFiltersTab(getOptionsHandle());
    const aaFLEnabled = await isCheckboxEnabled("#adblockFilterList_0");
    expect(aaFLEnabled).toEqual(expectAAEnabled);
    const aaFLPrivacyEnabled = await isCheckboxEnabled("#adblockFilterList_1");
    expect(aaFLPrivacyEnabled).toEqual(false);
  });

  it("only allows ads without third-party tracking", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    let aaPrivacyEnabled = await isCheckboxEnabled("#acceptable_ads_privacy");
    expect(aaPrivacyEnabled).toEqual(false);
    await clickOnDisplayedElement("label:has(> #acceptable_ads_privacy)");
    aaPrivacyEnabled = await isCheckboxEnabled("#acceptable_ads_privacy");
    expect(aaPrivacyEnabled).toEqual(true);
    const aaPrivacyHelper = await getDisplayedElement("#aa-privacy-helper > span", {
      timeout: 4000,
    });
    expect(await aaPrivacyHelper.getText()).toEqual(
      "For this feature to work properly, please enable Do Not Track (DNT) in your browser preferences.",
    );

    await initOptionsFiltersTab(getOptionsHandle());
    const aaFLPrivacyEnabled = await isCheckboxEnabled("#adblockFilterList_1");
    expect(aaFLPrivacyEnabled).toEqual(true);
  });

  it("disables allow AA", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    const aaEnabled = await isCheckboxEnabled("#acceptable_ads");
    const aaCheckbox = await getDisplayedElement("span:has(> #acceptable_ads)");
    if (!aaEnabled) {
      // Enables AA so it can be disabled afterwards to get the info message
      await aaCheckbox.click();
    }
    await aaCheckbox.click(); // disables AA

    const aaInfo = await getDisplayedElement("#acceptable_ads_info > span", {
      timeout: 3000,
      forceRefresh: false,
    });
    expect(await aaInfo.getText()).toEqual(
      "You're no longer subscribed to the Acceptable Ads filter list.",
    );
    const aaPrivacyEnabled = await isCheckboxEnabled("#acceptable_ads_privacy");
    expect(aaPrivacyEnabled).toEqual(false);

    await initOptionsFiltersTab(getOptionsHandle());
    const aaFLEnabled = await isCheckboxEnabled("#adblockFilterList_0");
    expect(aaFLEnabled).toEqual(false);
  });
};
