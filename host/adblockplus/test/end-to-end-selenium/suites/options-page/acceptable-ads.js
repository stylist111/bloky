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

import {
  isCheckboxEnabled,
  getDisplayedElement,
  clickOnDisplayedElement,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import {
  initOptionsGeneralTab,
  initOptionsAdvancedTab,
  setAADefaultState
} from "../../utils/page.js";

export default () => {
  after(async function () {
    await setAADefaultState();
  });

  it("displays AA default state", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    const aaEnabled = await isCheckboxEnabled("acceptable-ads-allow");
    expect(aaEnabled).toEqual(true);
    const aaPrivacyEnabled = await isCheckboxEnabled(
      "acceptable-ads-privacy-allow"
    );
    expect(aaPrivacyEnabled).toEqual(false);

    await initOptionsAdvancedTab(getOptionsHandle());
    await getDisplayedElement("[aria-label='Allow nonintrusive advertising']");
    await waitForNotDisplayed(
      "[aria-label='Allow nonintrusive advertising without third-party tracking']"
    );
  });

  it("only allows ads without third-party tracking", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    let aaPrivacyEnabled = await isCheckboxEnabled(
      "acceptable-ads-privacy-allow"
    );
    expect(aaPrivacyEnabled).toEqual(false);
    await clickOnDisplayedElement("#acceptable-ads-privacy-allow");
    aaPrivacyEnabled = await isCheckboxEnabled("acceptable-ads-privacy-allow");
    expect(aaPrivacyEnabled).toEqual(true);
    const aaPrivacyHelper = await getDisplayedElement("#dnt", {
      timeout: 4000
    });
    expect(await aaPrivacyHelper.getText()).toEqual(
      "Note: You have Do Not Track (DNT) disabled in your browser settings. For this feature to work properly, please enable DNT in your browser preferences. Find out how to enable DNT."
    );

    await initOptionsAdvancedTab(getOptionsHandle());
    await getDisplayedElement(
      "[aria-label='Allow nonintrusive advertising without third-party tracking']"
    );
    await waitForNotDisplayed("[aria-label='Allow nonintrusive advertising']");
  });

  it("disables allow AA", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    const aaEnabled = await isCheckboxEnabled("acceptable-ads-allow");
    const aaCheckbox = await getDisplayedElement("#acceptable-ads-allow");
    if (!aaEnabled) {
      // Enables AA so it can be disabled afterwards to get the info message
      await aaCheckbox.click();
    }
    await aaCheckbox.click(); // disables AA

    const aaInfo = await getDisplayedElement("#acceptable-ads-why-not", {
      timeout: 3000,
      forceRefresh: false
    });
    expect(await aaInfo.getText()).toContain(
      "To help us improve Adblock Plus, mind sharing why you’ve turned off Acceptable Ads?"
    );
    await clickOnDisplayedElement(
      "button[data-i18n='options_aa_opt_out_survey_no']"
    );
    await waitForNotDisplayed("#acceptable-ads-why-not");

    const aaPrivacyEnabled = await isCheckboxEnabled(
      "acceptable-ads-privacy-allow"
    );
    expect(aaPrivacyEnabled).toEqual(false);

    await initOptionsAdvancedTab(getOptionsHandle());
    await waitForNotDisplayed("[aria-label='Allow nonintrusive advertising']");
  });
};
