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
import { By, until } from "selenium-webdriver"; // Import By and until
import { openNewTab } from "@eyeo/test-utils/driver";
import {
  getExperimentFlagsFromExtension,
  sendExtCommandInTrustedIframe,
  loadPageWithTrustedIframe,
} from "../../utils/page.js";

export default () => {
  it("retrieves experiment flags from a trusted iframe injected into BT partner website", async function () {
    const BT_PARTNER_URL = "https://www.accuweather.com/";
    const TRUSTED_IFRAME_URL = "https://btloader.com/trustedIframe.html?o=5673795450830848";

    await openNewTab(BT_PARTNER_URL);

    // The page sometimes fails to load and needs to be refreshed
    const bodyText = await driver.findElement(By.css("body")).getText();
    if (bodyText.includes("can't reach this page")) {
      await driver.sleep(3000);
      await driver.navigate().refresh();
    }

    // Handle the cookie popup if it appears
    try {
      const acceptButton = await driver.wait(
        until.elementLocated(By.css('button[aria-label="Consent"]')),
        5000,
      );
      await driver.wait(until.elementIsVisible(acceptButton), 5000);
      await acceptButton.click();
    } catch (e) {}

    const trustedIframe = await loadPageWithTrustedIframe(BT_PARTNER_URL, TRUSTED_IFRAME_URL);

    // get experiment flags through the public API
    const responses = await sendExtCommandInTrustedIframe(trustedIframe, "getExperimentFlags");
    const flags = await getExperimentFlagsFromExtension();

    expect(responses.length).toEqual(1, "Response array should have one element.");
    expect(responses[0]).toMatchObject({
      requestId: expect.stringMatching(/\S/), // non-empty string
      name: extension.flattrName,
      version: extension.version,
      result: flags,
    });

    // error property should be missing
    expect(responses[0].error).toBeUndefined();
  });
};
