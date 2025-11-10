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

import { getOptionsHandle, setTimeoutForExtensionReload } from "@eyeo/test-utils/extension";
import {
  clickOnDisplayedElement,
  getDisplayedElement,
  isCheckboxPropertyEnabled,
  openNewTab,
  wait,
  waitForNotDisplayed,
} from "@eyeo/test-utils/driver";
import { dcTestPageUrl } from "@eyeo/test-utils/host-urls";
import { dcFilters } from "@eyeo/test-utils/host-filters";

import {
  changePremiumFLStatus,
  isPremiumActivated,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
  initOptionsPremiumFlTab,
  initPopupWithLocalPage,
  setPremiumFLsDefaultState,
} from "../../utils/page.js";
import { premiumFilterLists, premiumPopupToggleItems } from "../../utils/dataset.js";

export default () => {
  afterEach(async function () {
    if (await isPremiumActivated()) {
      await setPremiumFLsDefaultState();
    }
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    await disablePremiumProgrammatically();
  });

  it("logging in with a premium account", async function () {
    const isPremium = await isPremiumActivated();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await isPremiumActivated();
  });

  it("has premium features", async function () {
    const isPremium = await isPremiumActivated();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await isPremiumActivated();
    await clickOnDisplayedElement('[href="#mab-image-swap"]');
    await getDisplayedElement("#cats");

    await clickOnDisplayedElement('[href="#mab-themes"]');
    // Waiting for the selected icon to avoid the next click being ineffective
    await getDisplayedElement(".theme-selection .theme-selected-icon");
    await clickOnDisplayedElement('[data-key="options_page"][data-theme="dark_theme"]');
    // Check dark theme is displayed on options page
    await getDisplayedElement("#dark_theme");

    await clickOnDisplayedElement('[data-key="popup_menu"][data-theme="dark_theme"]');
    await initPopupWithLocalPage();
    // Check theme is displayed on popup page
    await getDisplayedElement("#dark_theme");

    const timeout = 3000;
    for (const { name, action } of premiumPopupToggleItems) {
      const cssSelector = `[data-name="${name}"]`;
      // Edge headless on macOS gets the element as "not displayed"
      const elem = await getDisplayedElement(cssSelector, { timeout, checkDisplayed: false });

      expect(await elem.getAttribute("data-is-checked")).toEqual(null);
      await clickOnDisplayedElement(elem, { timeout, checkDisplayed: false });

      const actionSelector = `[data-action="${action}"] > button`;
      // A sliding animation of the action button makes polling needed
      await wait(
        async () => {
          try {
            // Edge headless on macOS would click on a "button not interactable",
            // that's why the jsClick option is used
            await clickOnDisplayedElement(actionSelector, { checkDisplayed: false, jsClick: true });
            return true;
          } catch (e) {}
        },
        2000,
        `${actionSelector} was still displayed after clicking on it`,
      );

      await initPopupWithLocalPage();
    }

    const actualValues = {};
    const expectedValues = {};
    for (const { name } of premiumPopupToggleItems) {
      expectedValues[name] = "true";

      const toggleElement = await getDisplayedElement(`[data-name="${name}"]`, {
        timeout,
        checkDisplayed: false,
      });
      actualValues[name] = await toggleElement.getAttribute("data-is-checked");
    }
    expect(actualValues).toEqual(expectedValues);

    await openNewTab(dcTestPageUrl);
    await getDisplayedElement("#control-element");
    for (const dcFilter of dcFilters) {
      // Reload the page when premium filterlists haven't finished downloading
      await waitForNotDisplayed(dcFilter, {
        timeout: 5000,
        displayedTimeout: 1000,
        forceRefresh: true,
      });
    }
  });

  it("enables premium filter lists", async function () {
    const isPremium = await isPremiumActivated();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await initOptionsPremiumFlTab(getOptionsHandle());

    let someEnabled = false;
    for (const { checkboxSelector } of premiumFilterLists) {
      if (await isCheckboxPropertyEnabled(checkboxSelector)) {
        continue;
      }

      await changePremiumFLStatus(checkboxSelector, { enable: true });
      someEnabled = true;
    }

    if (!someEnabled) {
      throw new Error("All premium filterlists were previously enabled");
    }
  });

  it("downgrades if premium expired", async function () {
    setTimeoutForExtensionReload(this);
    const isPremium = await isPremiumActivated();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await isPremiumActivated();
    await disablePremiumProgrammatically();

    // Check the user is still logged in
    await getDisplayedElement("#user-account-manage", { timeout: 1000 });
    // Check premium is deactivated
    expect(await isPremiumActivated()).toBe(false);
  });
};
