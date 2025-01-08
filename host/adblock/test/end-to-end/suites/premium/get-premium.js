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
  getDisplayedElement,
  findUrl,
  openNewTab,
  waitForNotDisplayed,
  scrollToBottom,
  clickOnDisplayedElement,
  clickAndSendKeys,
} from "@eyeo/test-utils/driver";
import { dcTestPageUrl } from "@eyeo/test-utils/urls";
import { getOptionsHandle, getPremiumEmail } from "@eyeo/test-utils/extension";

import {
  initOptionsPremiumTab,
  enablePremiumProgrammatically,
  initPopupWithLocalPage,
} from "../../utils/page.js";
import { premiumPopupToggleItems } from "../../utils/dataset.js";
import { premiumUrl } from "../../utils/urls.js";

export default () => {
  it("activates premium by UI", async function () {
    this.timeout(80000); // See driver.sleep below

    const formattedDate = new Date()
      .toLocaleDateString("en-US", { year: "numeric", month: "long" })
      .toUpperCase();

    await initOptionsPremiumTab(getOptionsHandle());
    await clickOnDisplayedElement("#get-it-now-mab");

    const { url } = await findUrl(premiumUrl);
    await driver.navigate().to(`${url}&testmode`);
    await clickOnDisplayedElement('[data-plan="me"]');

    await scrollToBottom();

    await clickOnDisplayedElement('[i18n="complete_purchase"]', { timeout: 5000 });
    try {
      await driver.switchTo().frame("paddle_frame");
    } catch (err) {
      // First click didn't work, retrying
      await clickOnDisplayedElement('[i18n="complete_purchase"]', { timeout: 5000 });
      await driver.switchTo().frame("paddle_frame");
    }

    // First paying page
    // The first field of the loaded frame may take a while to appear
    clickAndSendKeys("#email > input", getPremiumEmail(), { timeout: 10000 });
    try {
      await clickAndSendKeys('[data-testid="postcodeInput"]', "10115", {
        timeout: 5000,
      });
    } catch (e) {} // Depending on the location, the ZIP may be required or not
    await clickOnDisplayedElement('[type="submit"]');

    // Second paying page
    await clickAndSendKeys("#cardNumber", "4242424242424242", { timeout: 5000 });
    await clickAndSendKeys("#cardHolder", "Test Automation");
    await clickAndSendKeys("#expiry", "0528");
    await clickAndSendKeys("#cvv", "295");
    await clickOnDisplayedElement('[data-testid="cardPaymentFormSubmitButton"]');

    await driver.switchTo().defaultContent();
    await clickOnDisplayedElement('[i18n="get_started_cta"]', { timeout: 20000 });

    await driver.switchTo().window(getOptionsHandle());
    await driver.navigate().refresh();

    const expectedStatus = new RegExp(`SUPPORTER SINCE ${formattedDate}|ACTIVE`);
    const premiumStatus = await getDisplayedElement("#premium_status_msg", { timeout: 4000 });
    expect(await premiumStatus.getText()).toMatch(expectedStatus);
  });

  it("has premium features", async function () {
    await enablePremiumProgrammatically();

    await clickOnDisplayedElement('[href="#mab-image-swap"]');
    await getDisplayedElement("#cats");
    await clickOnDisplayedElement('[href="#mab-themes"]');

    await clickOnDisplayedElement('[data-key="options_page"][data-theme="dark_theme"]');
    // Check dark theme is displayed on options page
    await getDisplayedElement("#dark_theme");

    await clickOnDisplayedElement('[data-key="popup_menu"][data-theme="dark_theme"]');
    await initPopupWithLocalPage();
    // Check theme is displayed on popup page
    await getDisplayedElement("#dark_theme");

    const timeout = 1000;
    for (const { name, action } of premiumPopupToggleItems) {
      await clickOnDisplayedElement(`[data-name="${name}"]`, {
        timeout,
        checkAttribute: { name: "data-is-checked", value: null },
      });

      const actionSelector = `[data-action="${action}"] > button`;
      // A sliding animation of the action button makes polling needed
      await driver.wait(
        async () => {
          try {
            await clickOnDisplayedElement(actionSelector);
            // The button may be clicked while it's still animated, making the
            // click ineffective. That's why the next check is needed
            await waitForNotDisplayed(actionSelector);
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
      });
      actualValues[name] = await toggleElement.getAttribute("data-is-checked");
    }
    expect(actualValues).toEqual(expectedValues);

    await openNewTab(dcTestPageUrl);
    await getDisplayedElement("#control-element");
    const dcFilters = ["#script-id-dc", "#element-id-dc"];
    for (const dcFilter of dcFilters) {
      await waitForNotDisplayed(dcFilter);
    }
  });
};
