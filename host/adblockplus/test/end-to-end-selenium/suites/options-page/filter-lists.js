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
import { By } from "selenium-webdriver";

import {
  isCheckboxEnabled,
  getDisplayedElement,
  clickOnDisplayedElement,
  findUrl,
  clickAndSendKeys,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, subscriptionUrl } from "@eyeo/test-utils/extension";
import { easylistFilter } from "@eyeo/test-utils/filters";

import {
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  getFLSelectors,
  waitForSubscriptionUpdated,
  clickFLToggleAndCheck
} from "../../utils/page.js";
import {
  getDefaultFilterLists,
  getBuiltinFilterLists
} from "../../utils/dataset.js";

async function setFilterListUrl(url) {
  await clickOnDisplayedElement("#filterlist-by-url-wrap");
  await clickAndSendKeys("#import-list-url", url);
  await clickOnDisplayedElement('[data-i18n="options_dialog_import_title"]');
}

async function getLanguageFilterlists(isOptionsGeneralTab) {
  const boxSelector = isOptionsGeneralTab ? "#languages-box" : "#filters-box";
  await clickOnDisplayedElement(boxSelector, { scrollIntoView: true });

  const popupSelector = isOptionsGeneralTab
    ? "#languages-boxpopup"
    : "#filters-boxpopup";

  // Poll until elements are not stale
  let languageElems;
  await driver.wait(
    async () => {
      languageElems = await driver.findElements(By.css(`${popupSelector} li`));
      try {
        await languageElems[0].getText();
        return true;
      } catch (err) {
        if (err.name !== "StaleElementReferenceError") {
          throw err;
        }
      }
    },
    2000,
    "Language elements text is not avaliable"
  );

  return languageElems;
}

async function addLanguageFilterlist(langName, isOptionsGeneralTab) {
  const languageElems = await getLanguageFilterlists(isOptionsGeneralTab);

  let langElem;
  for (const elem of languageElems) {
    if ((await elem.getText()).startsWith(langName)) {
      langElem = elem;
      break;
    }
  }
  if (!langElem) {
    const text = isOptionsGeneralTab ? "languages box" : "filters box";
    throw new Error(`${langName} EasyList was not found on ${text}`);
  }
  await langElem.click();

  // Check language list was added
  const tableSelector = isOptionsGeneralTab
    ? "#blocking-languages-table"
    : "#all-filter-lists-table";
  await getDisplayedElement(`${tableSelector} [aria-label="${langName}"]`, {
    timeout: 2000,
    forceRefresh: false
  });
}

export default () => {
  beforeEach(async function () {
    await initOptionsAdvancedTab(getOptionsHandle());
  });

  it("displays the default state", async function () {
    const defaultFilterLists = getDefaultFilterLists(extension.manifestVersion);

    for (const { name, enabled } of defaultFilterLists) {
      const { toggle, title } = getFLSelectors(name);
      const flEnabled = await isCheckboxEnabled(toggle);
      const flTitleElem = await getDisplayedElement(title);
      const flTitle = await flTitleElem.getText();

      expect({ name: flTitle, enabled: flEnabled }).toEqual({ name, enabled });
    }
  });

  it("shows the built in filter list dropdown", async function () {
    const languageElems = await getLanguageFilterlists(false);

    const actualFilterLists = [];
    for (const elem of languageElems) {
      let text = await elem.getText();

      if (!text) {
        // premium filterlists are not shown, so they return an empty string
        continue;
      } else if (text.startsWith("Free - Distraction Control")) {
        // That list doesn't appear in all environments.
        // Not testing it as a workaround
        continue;
      } else if (text.startsWith("IndianList+EasyList")) {
        // See getBuiltinFilterLists()
        text = "IndianList+EasyList";
      }

      actualFilterLists.push(text);
    }

    const expectedFilterLists = getBuiltinFilterLists(
      extension.manifestVersion
    );
    expect(actualFilterLists).toEqual(expectedFilterLists);
  });

  it("updates all filter lists", async function () {
    // A long timeout is needed because the 'Last Updated' text is changed to 'minutes ago'
    // one minute after installing. When running tests in the CI, more than a minute should
    // already pass before we get to this test, but when running it locally in isolation,
    // it will need more than a minute to run
    const longTimeout = 65000;

    this.timeout(longTimeout + 10000);

    const defaultFilterLists = getDefaultFilterLists(extension.manifestVersion);

    const waitForAllUpdated = async (regexp, timeout) => {
      await driver.wait(
        async () => {
          try {
            for (const { name } of defaultFilterLists) {
              await waitForSubscriptionUpdated(name, { regexp });
            }
            return true;
          } catch (e) {}
        },
        timeout,
        `Default filter lists were not updated ${regexp}`,
        500
      );
    };

    // Wait for filterlists to be updated "minutes ago"
    await waitForAllUpdated(/minutes ago/, longTimeout);

    await clickOnDisplayedElement("#update");
    await waitForAllUpdated(/Just now/, 5000);
  });

  it("goes to a filter list source page", async function () {
    const name = "Allow nonintrusive advertising";
    const aaUrl =
      extension.manifestVersion === 2
        ? "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
        : "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

    const { gear, sourceLink } = getFLSelectors(name);
    await clickOnDisplayedElement(gear);
    await clickOnDisplayedElement(sourceLink);

    await findUrl(aaUrl);
  });

  it("disables and reenables a filter list", async function () {
    const name = "EasyList";
    const { toggle } = getFLSelectors(name);

    // Check default state
    const enabled = await isCheckboxEnabled(toggle);
    expect({ name, enabled }).toEqual({ name, enabled: true });

    // Disable FL
    await clickFLToggleAndCheck(toggle, false);

    // Reenable FL
    await clickFLToggleAndCheck(toggle, true);

    await waitForSubscriptionUpdated(name, { timeout: 5000 });
  });

  it("removes and adds back a filter list", async function () {
    const name = "EasyList";
    const langName = "English";
    const { filterlist, trashBtn, toggle } = getFLSelectors(name);

    // Remove EasyList
    await clickOnDisplayedElement(trashBtn);
    await waitForNotDisplayed(filterlist);

    // Check no language-specific filters message
    await initOptionsGeneralTab(getOptionsHandle());
    const msgElem = await getDisplayedElement(
      "#blocking-languages-table .empty-placeholder"
    );
    expect(await msgElem.getText()).toEqual(
      "You don't have any language-specific filters."
    );

    // Add EasyList back
    await addLanguageFilterlist(langName, true);

    // Check EasyList on advanced tab
    await initOptionsAdvancedTab(getOptionsHandle());
    const enabled = await isCheckboxEnabled(toggle);
    expect({ name, enabled }).toEqual({ name, enabled: true });

    await waitForSubscriptionUpdated(name);
  });

  it("adds and removes a built in language filter list", async function () {
    const langNameAdvancedTab = "EasyList Polish+EasyList";
    const langNameGeneralTab = "polski + English";

    // Add filterlist on advanced tab
    await addLanguageFilterlist(langNameAdvancedTab, false);

    // Check filterlist was added on general tab
    await initOptionsGeneralTab(getOptionsHandle());
    await getDisplayedElement(
      `#blocking-languages-table [aria-label="${langNameGeneralTab}"]`
    );
  });

  it("adds and removes a filter list via URL", async function () {
    await setFilterListUrl(subscriptionUrl);
    await waitForSubscriptionUpdated(subscriptionUrl);

    const { filterlist, trashBtn } = getFLSelectors(subscriptionUrl);
    await clickOnDisplayedElement(trashBtn);
    await waitForNotDisplayed(filterlist);
  });

  it("displays an error for invalid filter list via URL", async function () {
    const invalidSubscriptionUrl = "invalid.txt";

    await setFilterListUrl(invalidSubscriptionUrl);
    const elem = await getDisplayedElement("#filterlist-by-url .error-msg");
    expect(await elem.getText()).toEqual("URL must start with https://.");
  });

  it("displays an error for disabled filters", async function () {
    const name = "EasyList";
    const errorMsg =
      "There are one or more issues with this filter list:\n" +
      "Some filters in this filter list are disabled.\nEnable them";
    const { toggle, tooltip } = getFLSelectors(name);

    // Check that EasyList is enabled
    let enabled = await isCheckboxEnabled(toggle);
    expect({ name, enabled }).toEqual({ name, enabled: true });

    // Add and disable easylist filter
    await clickAndSendKeys("io-filter-search > input", easylistFilter, {
      scrollIntoView: true
    });
    await driver.sleep(500); // The add button takes a while to become effective
    await clickOnDisplayedElement("io-filter-search > button");

    // Disable first filter
    const firstFilterSelector = "io-filter-list tr io-toggle";
    try {
      await clickOnDisplayedElement(firstFilterSelector, { timeout: 1000 });
    } catch (e) {
      // The toggle may not appear right after extension installation.
      // Refreshing as a workaround
      await driver.navigate().refresh();
      await initOptionsAdvancedTab(getOptionsHandle());
      await clickOnDisplayedElement(firstFilterSelector, { timeout: 1000 });
    }
    enabled = await isCheckboxEnabled(firstFilterSelector);
    expect({ easylistFilter, enabled }).toEqual({
      easylistFilter,
      enabled: false
    });

    // Check error message
    await clickOnDisplayedElement(tooltip);
    const tooltipMsgElem = await getDisplayedElement(
      `${tooltip} [role="tooltip"]`
    );
    expect(await tooltipMsgElem.getText()).toEqual(errorMsg);

    // Reenable filter through tooltip link
    await clickOnDisplayedElement(`${tooltip} [data-action="enable-filters"]`);
    await waitForNotDisplayed(tooltip);
    enabled = await isCheckboxEnabled(firstFilterSelector);
    expect({ easylistFilter, enabled }).toEqual({
      easylistFilter,
      enabled: true
    });
  });
};
