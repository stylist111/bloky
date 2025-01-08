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
  findUrl,
  clickOnDisplayedElement,
  clickAndSendKeys,
  getDisplayedElement,
  openNewTab,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, getPremiumEmail } from "@eyeo/test-utils/extension";
import { dcTestPageUrl } from "@eyeo/test-utils/urls";

import {
  initOptionsGeneralTab,
  initPopupWithLocalPage,
  enablePremiumProgrammatically,
  checkPremiumActivated
} from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";
import { premiumLinkButtons, premiumToggles } from "../../utils/dataset.js";

async function enablePremiumByUI() {
  await initOptionsGeneralTab(getOptionsHandle());
  const { selector } = premiumLinkButtons.find(
    ({ text }) => text === "Upgrade"
  );
  await clickOnDisplayedElement(selector);

  const { url } = await findUrl(premiumUrl);
  const premiumTestModeUrl = `${url}&testmode`;
  await driver.navigate().to(premiumTestModeUrl);

  await clickOnDisplayedElement('[data-plan="monthly"]');
  await clickOnDisplayedElement('[type="submit"]');

  await driver.wait(
    async () => {
      try {
        await driver.switchTo().frame("paddle_frame");
        return true;
      } catch (err) {
        if (err.name !== "NoSuchElementError") throw err;
      }
    },
    5000,
    "Could not switch to paddle_frame"
  );

  // First paying page
  // The first field of the loaded frame may take a while to appear
  await clickAndSendKeys("#email > input", getPremiumEmail(), {
    timeout: 10000
  });
  try {
    await clickAndSendKeys("#postcode > input", "10115", { timeout: 5000 });
  } catch (e) {} // Depending on the location, the ZIP may be required or not
  await clickOnDisplayedElement('[type="submit"]');

  // Second paying page
  await clickAndSendKeys("#cardNumber", "4242424242424242", { timeout: 5000 });
  await clickAndSendKeys("#cardHolder", "Test Automation");
  await clickAndSendKeys("#expiry", "0528");
  await clickAndSendKeys("#cvv", "295");
  await clickOnDisplayedElement('[data-testid="cardPaymentFormSubmitButton"]');

  // Premium onboarding
  await driver.switchTo().defaultContent();
  await clickOnDisplayedElement('[data-extension-page="premium-onboarding"]', {
    timeout: 20000
  });
  await findUrl(`${extension.origin}/premium-onboarding.html`);
}

export default () => {
  it("activates premium by UI", async function () {
    await enablePremiumByUI();
    await checkPremiumActivated();
  });

  it("has premium features", async function () {
    await enablePremiumProgrammatically();

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
    await clickOnDisplayedElement("#cookie-consent-modal-accept");

    await driver.wait(
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
    const dcFilters = ["#script-id-dc", "#element-id-dc"];
    for (const dcFilter of dcFilters) {
      await waitForNotDisplayed(dcFilter);
    }
  });
};
