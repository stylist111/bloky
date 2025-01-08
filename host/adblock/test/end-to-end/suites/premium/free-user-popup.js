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

import { getDisplayedElement, findUrl } from "@eyeo/test-utils/driver";

import { getOptionsHandle } from "@eyeo/test-utils/extension";
import { getUserIdFromStorage, initPopupWithLocalPage } from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";

export default () => {
  let fullPremiumUrl;

  before(async function () {
    const userId = await getUserIdFromStorage(getOptionsHandle());
    fullPremiumUrl = `${premiumUrl}/?u=${userId}`;
  });

  it("displays free user popup premium elements", async function () {
    const premiumFeatures = [
      { selector: '[data-name="cookieWalls"]', title: "Skip Cookie Walls" },
      { selector: '[data-name="blockDistractions"]', title: "Block Distractions" },
    ];

    for (const { selector, title } of premiumFeatures) {
      await initPopupWithLocalPage();

      const titleElem = await getDisplayedElement(`${selector} .title`, { forceRefresh: false });
      expect(await titleElem.getText()).toEqual(title);

      const learnMoreBtn = await getDisplayedElement(`${selector} button`);
      expect(await learnMoreBtn.getText()).toEqual("Learn More");

      // click will close current tab and opens a new one
      await learnMoreBtn.click();
      // find new opened tab
      await findUrl(fullPremiumUrl);
    }
  });
};
