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
  clickOnDisplayedElement,
  getDisplayedElement,
  openNewTab,
  waitForNotDisplayed,
  wait,
  findUrl
} from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  setTimeoutForExtensionReload
} from "@eyeo/test-utils/extension";
import { dcTestPageUrl } from "@eyeo/test-utils/host-urls";
import { dcFilters } from "@eyeo/test-utils/host-filters";
import {
  premiumLinkButtons,
  premiumToggles,
  premiumFilterLists
} from "../../utils/dataset.js";

import {
  initOptionsGeneralTab,
  initPopupWithLocalPage,
  isPremiumActivated,
  clickFLAndCheck,
  setPremiumFLsDefaultState,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically
} from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";

export default () => {
  afterEach(async function () {
    await setPremiumFLsDefaultState();
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    await disablePremiumProgrammatically();
  });

  it("logging in with a premium account", async function () {
    await enablePremiumProgrammatically();
    await isPremiumActivated();
  });

  it("has premium features", async function () {
    const isPremium = await isPremiumActivated();

    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await initPopupWithLocalPage();

    // Default popup premium togles
    const actualToggles = [];
    for (const { selector, name } of premiumToggles) {
      const elem = await getDisplayedElement(selector);
      const enabled = await elem.getAttribute("aria-checked");
      actualToggles.push({ selector, name, enabled });
    }
    expect(actualToggles).toEqual(premiumToggles);

    // Cookie filters can be enabled
    // Clicking right after the popup is loaded may be ineffective, sleeping as a workaround
    await driver.sleep(1000);

    const { selector } = premiumToggles.find(({ name }) => name === "cookie");
    await clickOnDisplayedElement(selector);
    await clickOnDisplayedElement("#cookie-consent-modal-accept", {
      timeout: 3000
    });

    await wait(
      async () => {
        const elem = await getDisplayedElement(selector);
        return (await elem.getAttribute("aria-checked")) === "true";
      },
      2000,
      `${selector} was not enabled after clicking on it`
    );

    // Distraction Control
    await openNewTab(dcTestPageUrl);
    await getDisplayedElement("#control-element");
    for (const dcFilter of dcFilters) {
      await waitForNotDisplayed(dcFilter);
    }
  });

  it("enables premium filter lists", async function () {
    const isPremium = await isPremiumActivated();

    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
    await initOptionsGeneralTab(getOptionsHandle());

    let someEnabled = false;
    for (const { name, stepsAfterClick } of premiumFilterLists) {
      const hasClicked = await clickFLAndCheck(name, {
        enable: true,
        stepsAfterClick
      });
      someEnabled = hasClicked || someEnabled;
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

    // Premium link/button checks
    for (const { selector, text } of premiumLinkButtons) {
      const elem = await getDisplayedElement(selector, {
        timeout: 5000,
        forceRefresh: true
      });
      expect(await elem.getText()).toEqual(text);

      await elem.click();
      await findUrl(premiumUrl, { timeout: 7000 });
      await driver.close();
      await initOptionsGeneralTab(getOptionsHandle());
    }
  });
};
