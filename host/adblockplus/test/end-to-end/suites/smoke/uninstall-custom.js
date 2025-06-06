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
  isCheckboxPropertyEnabled,
  wait
} from "@eyeo/test-utils/driver";
import {
  checkInstallUninstallUrl,
  initOptionsGeneralTab,
  initOptionsAdvancedTab,
  clickFLCheckboxAndCheck,
  getFLSelectors
} from "../../utils/page.js";
import {
  getOptionsHandle,
  uninstallExtension
} from "@eyeo/test-utils/extension";
import { uninstallUrl } from "../../utils/urls.js";

export default () => {
  it("uninstalls the extension with custom settings", async function () {
    const appVersion = await driver.executeScript(() => {
      return browser.runtime.getManifest().version;
    });

    // disable AA
    await initOptionsGeneralTab(getOptionsHandle(), {
      waitForDefaultState: true
    });
    await clickFLCheckboxAndCheck("#acceptable-ads-allow", {
      enable: false,
      name: "Acceptable Ads"
    });

    // disable easylist
    await initOptionsAdvancedTab(getOptionsHandle());
    const name = "EasyList";
    const { toggle } = getFLSelectors(name);

    await wait(
      async () => {
        try {
          await clickOnDisplayedElement(toggle, { timeout: 1000 });
          return true;
        } catch (e) {
          await clickOnDisplayedElement("#update");
          // eslint-disable-next-line no-console
          console.log(
            "Easylist toggle not found, trying to update filter lists"
          );
        }
      },
      10000,
      "Easylist toggle not found",
      2000
    );

    await wait(
      async () => !(await isCheckboxPropertyEnabled(toggle)),
      2000,
      "Easylist still enabled after clicking on the toggle"
    );

    await uninstallExtension(initOptionsGeneralTab);
    const { url } = await findUrl(uninstallUrl);

    await checkInstallUninstallUrl({ url, appVersion, uninstall: true });
  });
};
