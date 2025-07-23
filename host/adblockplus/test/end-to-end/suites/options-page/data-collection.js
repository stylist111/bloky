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
  isCheckboxAttributeEnabled,
  getDisplayedElement,
  clickOnDisplayedElement,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import { initOptionsAdvancedTab } from "../../utils/page.js";

async function getOptOutFlag() {
  return await driver.executeScript(() =>
    browser.runtime.sendMessage({
      type: "prefs.get",
      key: "data_collection_opt_out"
    })
  );
}

export default () => {
  it("displays the data collection notice on non firefox browsers", async function () {
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await initOptionsAdvancedTab(getOptionsHandle());

    // Make sure we see the data collection section
    await getDisplayedElement("#data-collection");

    const selector = "[data-pref='data_collection_opt_out']>button";

    expect(await getOptOutFlag()).toBe(false);
    expect(await isCheckboxAttributeEnabled(selector)).toBe(false);

    await clickOnDisplayedElement(selector);

    expect(await getOptOutFlag()).toBe(true);
    expect(await isCheckboxAttributeEnabled(selector)).toBe(true);

    await clickOnDisplayedElement(selector);

    expect(await getOptOutFlag()).toBe(false);
    expect(await isCheckboxAttributeEnabled(selector)).toBe(false);
  });

  it("displays the data collection notice on firefox browsers", async function () {
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await initOptionsAdvancedTab(getOptionsHandle());
    await waitForNotDisplayed("#data-collection");

    expect(await getOptOutFlag()).toBe(true);
  });
};
