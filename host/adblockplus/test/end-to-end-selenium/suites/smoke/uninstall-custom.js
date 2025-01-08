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
  waitForNotNullProperty
} from "@eyeo/test-utils/driver";
import {
  checkInstallUninstallUrl,
  initOptionsGeneralTab,
  initOptionsAdvancedTab,
  clickCheckbox
} from "../../utils/page.js";
import {
  getOptionsHandle,
  uninstallExtension
} from "@eyeo/test-utils/extension";
import { uninstallUrl } from "../../utils/urls.js";

export default () => {
  it("uninstalls the extension with custom settings", async function () {
    // https://eyeo.atlassian.net/browse/EXT-153
    if (browserDetails.browserName === "edge") this.skip();

    const appVersion = await driver.executeScript(() => {
      return browser.runtime.getManifest().version;
    });

    // disable AA
    await initOptionsGeneralTab(getOptionsHandle(), 5000, true);
    await clickCheckbox("acceptable-ads-allow", false);

    // disable easylist
    await initOptionsAdvancedTab(getOptionsHandle());
    const name = "ads";
    const toggleSelector = `#all-filter-lists-table [data-recommended="${name}"] io-toggle`;
    await clickOnDisplayedElement(toggleSelector);
    await driver.wait(
      async () => {
        const value = await waitForNotNullProperty(toggleSelector, "checked");
        return value === false;
      },
      2000,
      "Easylist still enabled after clicking on the toggle"
    );

    await uninstallExtension(initOptionsGeneralTab);
    const { url } = await findUrl(uninstallUrl);

    await checkInstallUninstallUrl({ url, appVersion, uninstall: true });
  });
};
