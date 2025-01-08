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
import { By } from "selenium-webdriver";

import {
  isCheckboxEnabled,
  getDisplayedElement,
  findUrl,
  waitForNotDisplayed,
  clickOnDisplayedElement,
  clickAndSendKeys,
} from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import {
  initOptionsGeneralTab,
  initOptionsFiltersTab,
  getSubscriptionInfo,
  clickFilterlist,
  waitForSubscribed,
  expectAAEnabled,
} from "../../utils/page.js";
import { getDefaultFilterLists, languageFilterLists } from "../../utils/dataset.js";

async function setFilterListUrl(url) {
  await clickAndSendKeys("#txtNewSubscriptionUrl", url);
  await clickOnDisplayedElement("#btnNewSubscriptionUrl");
}

export default () => {
  beforeEach(async function () {
    await initOptionsFiltersTab(getOptionsHandle());
  });

  it("displays the default state", async function () {
    const defaultFilterLists = getDefaultFilterLists(expectAAEnabled);

    for (const { name, inputId, text, enabled } of defaultFilterLists) {
      const flEnabled = await isCheckboxEnabled(inputId);
      const selector =
        name === "acceptable_ads_privacy"
          ? `[name="${name}"] > label`
          : `[name="${name}"] > label h1`;
      const flElem = await getDisplayedElement(selector);
      const flText = await flElem.getText();

      expect({ name, text: flText, enabled: flEnabled }).toEqual({ name, text, enabled });
    }
  });

  it("shows the built in language filter list dropdown", async function () {
    const dropdown = await getDisplayedElement("#language_select");
    const actualLanguageLists = [];
    for (const option of await dropdown.findElements(By.css("option"))) {
      const name = await option.getAttribute("value");
      if (!name) {
        continue;
      }

      const text = await option.getText();
      actualLanguageLists.push({ name, text });
    }

    expect(actualLanguageLists).toEqual(
      languageFilterLists.map(({ name, text }) => ({ name, text })),
    );
  });

  it("updates all filter lists", async function () {
    this.timeout(40000); // Updating all filter list may take longer depending on network conditions

    const defaultFilterLists = getDefaultFilterLists(expectAAEnabled).filter(
      ({ enabled }) => enabled,
    );

    const checkDefaultSubscriptionsInfo = async (updatedWhen, timeout) => {
      await driver.wait(
        async () => {
          try {
            for (const { name } of defaultFilterLists) {
              const text = await getSubscriptionInfo(name);
              expect(text).toMatch(new RegExp(`updated.*${updatedWhen}`));
            }
            return true;
          } catch (e) {}
        },
        timeout,
        `Filter lists were not updated "${updatedWhen}" after ${timeout}ms`,
        500,
      );
    };

    await checkDefaultSubscriptionsInfo("ago", 20000);

    await clickOnDisplayedElement("#btnUpdateNow");
    await checkDefaultSubscriptionsInfo("right now", 10000);
    await checkDefaultSubscriptionsInfo("seconds ago", 20000);
  });

  it("goes to a filter list source page", async function () {
    const aaUrl =
      extension.manifestVersion === 2
        ? "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
        : "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

    const enableAdvancedUser = async () => {
      const advancedUserEnabled = await isCheckboxEnabled("enable_show_advanced_options");
      if (!advancedUserEnabled) {
        await clickOnDisplayedElement("span:has(> #enable_show_advanced_options)");
        await driver.wait(
          async () => isCheckboxEnabled("enable_show_advanced_options"),
          2000,
          "The advanced user was not enabled after clicking",
        );
      }
    };

    await initOptionsGeneralTab(getOptionsHandle());
    await enableAdvancedUser();

    await initOptionsFiltersTab(getOptionsHandle());
    await clickOnDisplayedElement("#btnShowLinks");
    await clickOnDisplayedElement('[name="acceptable_ads"] > label a.filter-list-link');
    await findUrl(aaUrl);
  });

  for (const name of ["anticircumvent", "easylist"]) {
    it(`disables and reenables the ${name} filter list`, async function () {
      const { inputId } = getDefaultFilterLists(expectAAEnabled).find((fl) => fl.name === name);

      const flEnabled = await isCheckboxEnabled(inputId);
      expect(flEnabled).toEqual(true);

      await clickFilterlist(name, inputId, false);
      const text = await getSubscriptionInfo(name);
      expect(text).toEqual("Unsubscribed.");

      if (name === "easylist") {
        const mainInfo = await getDisplayedElement("#easylist_info > b");
        expect(await mainInfo.getText()).toEqual(
          "AdBlock uses EasyList to block ads on most websites.",
        );
        const otherInfo = await getDisplayedElement("#easylist_info > span");
        expect(await otherInfo.getText()).toEqual(
          'We recommend keeping it on. If you unsubscribed by accident, please select "EasyList" now to block more ads.',
        );
      }

      await driver.sleep(1000); // Clicking right after unsubscribed may be ineffective
      await clickFilterlist(name, inputId, true);
      await waitForSubscribed(name, inputId);
    });
  }

  it("adds and removes a language filter list", async function () {
    const name = "easylist_plus_vietnamese";
    const inputId = "languageFilterList_24";

    await clickOnDisplayedElement(`#language_select > option[value="${name}"]`);
    await waitForSubscribed(name, inputId, { allowFetching: true });

    await driver.sleep(1500); // Clicking right after subscribed may be ineffective
    await clickFilterlist(name);
    await waitForNotDisplayed(`[name="${name}"]`);
  });

  it("adds and removes a filter list via URL", async function () {
    const subscriptionUrl = "https://abptestpages.org/en/abp-testcase-subscription.txt";
    const name = `url:${subscriptionUrl}`;
    const inputId = "customFilterList_1";

    await setFilterListUrl(subscriptionUrl);
    await waitForSubscribed(name, inputId, { allowFetching: true });

    await clickFilterlist(name, inputId, false);
    await clickOnDisplayedElement(`[name="${name}"] a.remove_filterList`);
    await waitForNotDisplayed(`[name="${name}"]`);
  });

  it("displays an error for invalid filter list via URL", async function () {
    const invalidSubscriptionUrl = "invalid.txt";
    const name = `url:${invalidSubscriptionUrl}`;

    await setFilterListUrl(invalidSubscriptionUrl);

    const alert = await driver.switchTo().alert();
    expect(await alert.getText()).toEqual("Failed to fetch this filter!");
    await alert.accept();
    await waitForNotDisplayed(`[name="${name}"]`);
  });
};
