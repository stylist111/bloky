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

import { getDisplayedElement, openNewTab, getTabId } from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import { initOptionsGeneralTab, initPopupPage } from "../utils/page.js";

export default () => {
  it("should auto-allowlist YouTube", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    const websiteHandle = await openNewTab("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const tabId = await getTabId(getOptionsHandle());
    await driver.switchTo().window(websiteHandle);

    await driver.executeScript(() => {
      const ytElement = document.createElement("ytd-enforcement-message-view-model");
      document.body.appendChild(ytElement);
    });
    await driver.wait(
      async () => {
        const readyState = await driver.executeScript("return document.readyState");
        return readyState === "complete";
      },
      2000,
      "Page did not refresh within the expected time",
    );

    await initPopupPage(tabId);
    const domainPausedText = await getDisplayedElement('[i18n="status_domain_paused"]');
    expect(await domainPausedText.getText()).toEqual(
      "AdBlock is paused for this visit. You may need to refresh the page to see your changes.",
    );
  });
};
