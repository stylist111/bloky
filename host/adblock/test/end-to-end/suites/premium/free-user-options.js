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

import { getOptionsHandle } from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  clickAndCloseNewTab,
  clickAndNavigateBack,
} from "@eyeo/test-utils/driver";

import {
  getUserIdFromStorage,
  initOptionsPremiumTab,
  initOptionsThemesTab,
  initOptionsImageSwapTab,
  initOptionsBackupSyncTab,
  initOptionsPremiumFlTab,
  checkPremiumPageHeader,
} from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";

export default () => {
  let fullPremiumUrl;

  before(async function () {
    const userId = await getUserIdFromStorage(getOptionsHandle());
    fullPremiumUrl = `${premiumUrl}/?u=${userId}`;
  });

  it("displays cta and premium features", async function () {
    await initOptionsPremiumTab(getOptionsHandle());
    await checkPremiumPageHeader(
      "#locked-user-pay-section-mab > p",
      "#get-it-now-mab",
      fullPremiumUrl,
    );

    const features = await driver.findElements(By.css("#myadblock-features > div"));
    expect(features.length).toEqual(4);

    // click on each feature and check if it navigates to the correct premium page
    const hashes = ["#premium-filters", "#mab-image-swap", "#mab-themes", "#sync"];
    for (let i = 0; i < hashes.length; i++) {
      const selector = `#myadblock-features > div:nth-child(${i + 1})`;
      await clickAndNavigateBack(selector, `${extension.origin}/options.html${hashes[i]}`);
    }
  });

  const selectors = [
    {
      selector: ".popup-menu-themes",
      expectedLockedThemeIds: [
        "solarized_theme",
        "solarized_light_theme",
        "watermelon_theme",
        "ocean_theme",
        "sunshine_theme",
      ],
    },
    {
      selector: ".options-page-themes",
      expectedLockedThemeIds: ["solarized_theme", "solarized_light_theme"],
    },
  ];
  for (const { selector, expectedLockedThemeIds } of selectors) {
    it(`shows ${selector} themes correctly`, async function () {
      await initOptionsThemesTab(getOptionsHandle());
      await checkPremiumPageHeader(
        "#locked-user-pay-section-themes > p",
        "#get-it-now-themes",
        fullPremiumUrl,
      );

      const selectedTheme = await getDisplayedElement(`${selector} .theme-box.selected`);
      expect(await selectedTheme.getAttribute("data-theme")).toEqual("default_theme");

      const lockedThemesElems = await driver.findElements(
        By.css(`${selector} .theme-wrapper.locked .theme-box`),
      );

      const lockedThemesIds = await Promise.all(
        lockedThemesElems.map((e) => e.getAttribute("data-theme")),
      );

      expect(lockedThemesIds.sort()).toEqual(expectedLockedThemeIds.sort());

      for (const themeId of expectedLockedThemeIds) {
        await clickAndCloseNewTab(`${selector} [data-theme="${themeId}"]`, fullPremiumUrl);
      }
    });
  }

  it("shows image swap off", async function () {
    await initOptionsImageSwapTab(getOptionsHandle());

    await checkPremiumPageHeader(
      "#locked-user-pay-section-image-swap > p",
      "#get-it-now-image-swap",
      fullPremiumUrl,
    );

    const selectedOption = await getDisplayedElement("#channel-options .selected");
    expect(await selectedOption.getText()).toContain("Don't swap ads");

    const lockedOptions = await driver.findElements(By.css("#channel-options .locked"));
    expect(lockedOptions.length).toEqual(8);

    // click on all locked options
    for (let i = 0; i < 8; i++) {
      await clickAndCloseNewTab(`#channel-options > li:nth-child(${i + 2})`, fullPremiumUrl);
    }
  });

  it("shows backup & sync off", async function () {
    await initOptionsBackupSyncTab(getOptionsHandle());
    await checkPremiumPageHeader(
      "#locked-user-pay-section-sync > p",
      "#get-it-now-sync",
      fullPremiumUrl,
    );

    const ctaLink = await getDisplayedElement("#get-sync");
    expect(await ctaLink.getText()).toEqual("Get Sync");

    await clickAndCloseNewTab("#get-sync", fullPremiumUrl);
  });

  it("shows premium filter lists locked in options page", async function () {
    await initOptionsPremiumFlTab(getOptionsHandle());
    await checkPremiumPageHeader(
      "#locked-user-pay-section-distraction-control > p",
      "#get-it-now-distraction-control",
      fullPremiumUrl,
    );

    const lockedIcons = await driver.findElements(
      By.css(".filter-subscription-wrapper .locked .premium_locked_icon"),
    );
    const iconsVisibility = await Promise.all(lockedIcons.map((i) => i.isDisplayed()));
    expect(iconsVisibility).toEqual([true, true]);

    const listTitlesElems = await driver.findElements(
      By.css(".filter-subscription-wrapper .locked .premium_filter_list_title"),
    );

    const listTitles = await Promise.all(listTitlesElems.map((e) => e.getText()));
    expect(listTitles).toEqual(["Enhanced Distraction Control", "Cookie Consent Cutter"]);

    // check distraction control link
    await clickAndCloseNewTab("#premium-filter-lists > div:nth-child(1)", fullPremiumUrl);
    // check cookie consent cutter link
    await clickAndCloseNewTab("#premium-filter-lists > div:nth-child(2)", fullPremiumUrl);
  });
};
