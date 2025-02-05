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

import {
  clickOnDisplayedElement,
  findUrl,
  openNewTab
} from "@eyeo/test-utils/driver";
import { blockHideUrl, blockHideLocalhostUrl } from "@eyeo/test-utils/urls";
import {
  checkBlockHidePage,
  setPausedStateFromPopup,
  initPopupPage
} from "../utils/page.js";

export default () => {
  it("opens the settings page", async function () {
    // After we close the options page we need a tab to switch to
    // We can not use the popup tab for this like in AdBlock, because the popup tab is closed when it loses focus
    const websiteHandle = await openNewTab(blockHideLocalhostUrl);

    await findUrl("options.html");
    await driver.close();
    await driver.switchTo().window(websiteHandle);
    await initPopupPage();
    await clickOnDisplayedElement("#options");
    await findUrl("options.html");
  });

  it("allowlists from popup", async function () {
    const websiteHandle = await openNewTab(blockHideUrl);

    await checkBlockHidePage(false);

    // allowlist
    await setPausedStateFromPopup(blockHideUrl, true);
    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();
    await checkBlockHidePage(true);

    // disallowlist
    await setPausedStateFromPopup(blockHideUrl, false);
    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();
    await checkBlockHidePage(false);
  });
};
