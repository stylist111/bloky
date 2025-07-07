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

import { getDisplayedElement } from "@eyeo/test-utils/driver";
import { getOptionsHandle, autoAllowlistsYoutube } from "@eyeo/test-utils/extension";

import { initOptionsGeneralTab, initPopupPage } from "../utils/page.js";

export default () => {
  it("auto-allowlists YouTube", async function () {
    // This scenario is already covered by the Fragments tests for Chromium and Firefox
    if (browserDetails.browserName !== "edge") {
      this.skip();
    }

    await initOptionsGeneralTab(getOptionsHandle());

    const tabId = await autoAllowlistsYoutube();

    await initOptionsGeneralTab(getOptionsHandle());

    const returnedFilters = await driver.executeAsyncScript(async (callback) => {
      const filters = await browser.runtime.sendMessage({ type: "filters.get" });
      callback(filters);
    });

    expect(returnedFilters[0].text).toEqual("@@||youtube.com^$document");
    expect(returnedFilters[0].type).toEqual("allowing");

    await initPopupPage(tabId);

    const domainPausedText = await getDisplayedElement("#domain_paused_subsection", {
      forceRefresh: true,
    });
    expect(await domainPausedText.getText()).toEqual("Resume Ad Blocking");
  });
};
