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
  clickOnDisplayedElement,
  findUrl,
  getDisplayedElement,
  openNewTab,
  waitForNotDisplayed,
  waitForNotNullProperty
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, reloadExtension } from "@eyeo/test-utils/extension";
import {
  checkInstallUninstallUrl,
  waitForAdsBlockedToBeInRange,
  initOptionsAdvancedTab,
  initPopupPage,
  initOptionsGeneralTab
} from "../../utils/page.js";
import { blockHideUrl } from "@eyeo/test-utils/urls";
import { installUrl } from "../../utils/urls.js";
import { defaultFilterLists } from "../../utils/dataset.js";

export default () => {
  it("opens the install url", async function () {
    const { url } = await findUrl(installUrl, 10000);

    await driver.switchTo().window(getOptionsHandle());
    const appVersion = await driver.executeScript(() => {
      return browser.runtime.getManifest().version;
    });

    await checkInstallUninstallUrl({ url, appVersion, uninstall: false });
  });

  it("displays total ad block count", async function () {
    const maxAdsBlocked = 15;

    const websiteHandle = await openNewTab(blockHideUrl);
    const blockedFirst = await waitForAdsBlockedToBeInRange(0, maxAdsBlocked);

    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();

    await waitForAdsBlockedToBeInRange(blockedFirst, maxAdsBlocked);
  });

  it("resets settings", async function () {
    this.timeout(50000); // The options page may take long time to appear after reloading the extension

    await initOptionsAdvancedTab(getOptionsHandle());

    const timeout = 2000;
    const firstFLSelector = `#all-filter-lists-table [data-recommended="${defaultFilterLists[0].name}"]`;
    // Wait for the first filter list to be displayed
    await getDisplayedElement(firstFLSelector, {
      timeout,
      forceRefresh: false
    });

    // Remove default filter lists
    for (const { name } of defaultFilterLists) {
      const trashBtnSelector = `#all-filter-lists-table [data-recommended="${name}"] [data-action="remove-subscription"]`;
      // Right after extension initialisation clicking on the trash button may not work, retrying as a workaround
      await driver.wait(
        async () => {
          await clickOnDisplayedElement(trashBtnSelector, { timeout });
          try {
            await waitForNotDisplayed(trashBtnSelector, timeout);
            return true;
          } catch (err) {
            if (err.name !== "TimeoutError") throw err;
          }
        },
        5000,
        `Filterlist ${name} could not be removed`
      );
    }

    const emptyPlaceholder = await getDisplayedElement(
      "#all-filter-lists-table .empty-placeholder",
      { timeout, forceRefresh: false }
    );
    expect(await emptyPlaceholder.getText()).toContain(
      "You have not added any filter lists to Adblock Plus"
    );

    // reload the extension to restore the default settings
    await reloadExtension(initOptionsGeneralTab);

    await initOptionsAdvancedTab(getOptionsHandle());
    // Wait for the first filter list to be displayed
    await getDisplayedElement(firstFLSelector, {
      timeout,
      forceRefresh: false
    });
    // check default filter lists are enabled
    const actualFilterLists = [];
    for (const { name } of defaultFilterLists) {
      const toggleSelector = `#all-filter-lists-table [data-recommended="${name}"] io-toggle`;
      const value = await waitForNotNullProperty(toggleSelector, "checked");
      actualFilterLists.push({ name, enabled: value });
    }
    expect(actualFilterLists).toEqual(defaultFilterLists);

    // check reset settings notification in popup
    await initPopupPage();
    const notification = await getDisplayedElement("#notification-message");
    expect(await notification.getText()).toContain(
      "An issue has caused your ABP settings to be reset to default"
    );
    await clickOnDisplayedElement("#notification-message > a");
    const expectedUrl = `${extension.origin}/problem.html`;
    await findUrl(expectedUrl);
  });
};
