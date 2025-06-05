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
  isCheckboxPropertyEnabled,
  openNewTab,
  waitForNotDisplayed,
  wait
} from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  reloadExtension,
  waitForNumberToBeInRange
} from "@eyeo/test-utils/extension";
import {
  checkInstallUninstallUrl,
  initOptionsAdvancedTab,
  initPopupPage,
  initOptionsGeneralTab,
  getFLSelectors,
  getPopupBlockedAdsTotalCount,
  manageFilterListsError,
  checkSubscriptionsState
} from "../../utils/page.js";
import { blockHideUrl } from "@eyeo/test-utils/urls";
import { installUrl } from "../../utils/urls.js";
import { getDefaultFilterLists } from "../../utils/dataset.js";

export default () => {
  it("opens the install url", async function () {
    const { url } = await findUrl(installUrl, 10000);

    await driver.switchTo().window(getOptionsHandle());
    const appVersion = await driver.executeScript(() => {
      return browser.runtime.getManifest().version;
    });

    await checkInstallUninstallUrl({ url, appVersion, uninstall: false });
  });

  it("sets the install date", async function () {
    await driver.switchTo().window(getOptionsHandle());

    let installDate = 0;
    await wait(
      async () => {
        installDate = await driver.executeScript(() => {
          return browser.runtime.sendMessage({
            type: "prefs.get",
            key: "installDate"
          });
        });
        return installDate !== 0;
      },
      5000,
      "Expected install date preference to be set"
    );

    const extensionDate = new Date(installDate);
    const now = new Date();

    expect(extensionDate.getFullYear()).toEqual(now.getFullYear());
    expect(extensionDate.getMonth()).toEqual(now.getMonth());
    expect(extensionDate.getDate()).toEqual(now.getDate());
  });

  it("displays the default filter lists state", async function () {
    await initOptionsAdvancedTab(getOptionsHandle());

    const defaultFilterLists = getDefaultFilterLists(extension.manifestVersion);
    try {
      await checkSubscriptionsState(defaultFilterLists);
    } catch (err) {
      // Workaround for when filter lists fail to download,
      // see: https://eyeo.atlassian.net/browse/EXT-874
      console.warn(
        `There were issues with some of the default subscriptions:\n${err.message}\nUpdating them as a workaround`
      );
      await clickOnDisplayedElement("#update");
      // sleeping to let the button click be effective
      await driver.sleep(200);
      await checkSubscriptionsState(defaultFilterLists);
    }
  });

  it("displays total ad block count", async function () {
    const maxAdsBlocked = 15;

    const websiteHandle = await openNewTab(blockHideUrl);
    const blockedFirst = await waitForNumberToBeInRange(
      0,
      maxAdsBlocked,
      getPopupBlockedAdsTotalCount
    );

    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();

    await waitForNumberToBeInRange(
      blockedFirst,
      maxAdsBlocked,
      getPopupBlockedAdsTotalCount
    );
  });

  it("resets settings", async function () {
    this.timeout(50000); // The options page may take long time to appear after reloading the extension

    await initOptionsAdvancedTab(getOptionsHandle());

    const timeout = 2000;
    const defaultFilterLists = getDefaultFilterLists(extension.manifestVersion);
    const { filterlist: firstFLSelector } = getFLSelectors(
      defaultFilterLists[0].name
    );
    // Wait for the first filter list to be displayed
    await getDisplayedElement(firstFLSelector, { timeout });

    // Remove default filter lists
    for (const { name } of defaultFilterLists) {
      const { trashBtn } = getFLSelectors(name);
      // Right after extension initialisation clicking on the trash button may not work, retrying as a workaround
      await wait(
        async () => {
          await clickOnDisplayedElement(trashBtn, { timeout });
          try {
            await waitForNotDisplayed(trashBtn, { timeout });
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
      { timeout }
    );
    expect(await emptyPlaceholder.getText()).toContain(
      "You have not added any filter lists to Adblock Plus"
    );

    // reload the extension to restore the default settings
    await reloadExtension(initOptionsGeneralTab);

    // Wait for the first filter list to be displayed
    let errMsg;
    try {
      await wait(async () => {
        await driver.navigate().refresh();
        await initOptionsAdvancedTab(getOptionsHandle());
        try {
          await getDisplayedElement(firstFLSelector, {
            timeout: 2000,
            verboseLogging: true
          });
          return true;
        } catch (err) {
          errMsg = err.message;
        }
      }, 8000);
    } catch (e) {
      await manageFilterListsError(errMsg);
    }
    // check default filter lists are enabled
    const actualFilterLists = [];
    for (const { name } of defaultFilterLists) {
      const { filterlist } = getFLSelectors(name);
      // FLs sometimes take time to load after extension reload
      await getDisplayedElement(filterlist, { timeout: 4000 });
      const { toggle } = getFLSelectors(name);
      const enabled = await isCheckboxPropertyEnabled(toggle);
      actualFilterLists.push({ name, enabled });
    }
    expect(actualFilterLists).toEqual(defaultFilterLists);

    // check reset settings notification in popup
    await initPopupPage();
    const notification = await getDisplayedElement("#notification-message", {
      timeout: 1000,
      forceRefresh: true
    });
    expect(await notification.getText()).toContain(
      "An issue has caused your ABP settings to be reset to default"
    );
    await clickOnDisplayedElement("#notification-message > a");
    const expectedUrl = `${extension.origin}/problem.html`;
    await findUrl(expectedUrl);
  });
};
