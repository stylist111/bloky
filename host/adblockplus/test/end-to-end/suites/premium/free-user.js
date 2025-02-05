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
  getDisplayedElement,
  findUrl,
  clickOnDisplayedElement,
  getCSSProperty,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";

import { getOptionsHandle } from "@eyeo/test-utils/extension";
import {
  initOptionsGeneralTab,
  initPopupWithLocalPage
} from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";
import { premiumLinkButtons, premiumToggles } from "../../utils/dataset.js";

export default () => {
  it("displays free user popup premium elements", async function () {
    await initPopupWithLocalPage();

    for (const { selector } of premiumToggles) {
      await waitForNotDisplayed(selector);
    }

    const premiumTitles = [
      "premium_cookies_title",
      "premium_distractions_title"
    ];
    for (const title of premiumTitles) {
      const elem = await getDisplayedElement(
        `#page-premium-cta [data-i18n="${title}"]`
      );
      const backgroundImage = await getCSSProperty(
        elem,
        "background-image",
        "::before"
      );
      expect(backgroundImage).toContain("skin/icons/premium-lock.svg");
    }

    await clickOnDisplayedElement("#premium-upgrade");
    await findUrl(premiumUrl);
  });

  it("displays free user options premium elements", async function () {
    await initOptionsGeneralTab(getOptionsHandle());

    // Premium link/button checks
    for (const { selector, text } of premiumLinkButtons) {
      const elem = await getDisplayedElement(selector, { forceRefresh: false });
      expect(await elem.getText()).toEqual(text);

      await elem.click();
      await findUrl(premiumUrl);
      await driver.close();
      await initOptionsGeneralTab(getOptionsHandle());
    }

    // Locked premium filterlists checks
    const freeUserPremiumLists = ["cookies-premium", "annoyances"];
    for (const title of freeUserPremiumLists) {
      await getDisplayedElement(
        `#premium-list-table [data-recommended="${title}"]`
      );

      await driver.wait(
        async () => {
          const btnElem = getDisplayedElement(
            `#premium-list-table [data-recommended="${title}"] > button`
          );
          const backgroundImage = await getCSSProperty(
            btnElem,
            "background-image",
            "::before"
          );
          try {
            expect(backgroundImage).toContain("skin/icons/premium-lock.svg");
            return true;
          } catch (e) {
            // Right after initialisation the lock icon may not appear. Refreshing as a workaround
            await driver.navigate().refresh();
            await initOptionsGeneralTab(getOptionsHandle());
          }
        },
        5000,
        "Lock icon on free user options wasn't displayed"
      );
    }
  });
};
