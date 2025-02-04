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

import { waitForCheckboxStatus } from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  autoAllowlistsYoutube
} from "@eyeo/test-utils/extension";

import { initOptionsGeneralTab, initPopupPage } from "../utils/page.js";

export default () => {
  it("auto-allowlists YouTube", async function () {
    await initOptionsGeneralTab(getOptionsHandle());

    const tabId = await autoAllowlistsYoutube();

    const websiteAllowlistBtnSelector = `#page-status > div:first-of-type > io-circle-toggle`;

    await driver.wait(
      async () => {
        await initPopupPage(tabId);
        try {
          await waitForCheckboxStatus(websiteAllowlistBtnSelector, {
            timeout: 3000,
            expectEnabled: false,
            isProperty: true,
            name: "Website Allowlist Toggle",
            action: "Youtube Auto Allowlisting"
          });
          return true;
        } catch (e) {}
      },
      7000,
      `Website allowlist toggle was not disabled after allowlisting`
    );
  });
};
