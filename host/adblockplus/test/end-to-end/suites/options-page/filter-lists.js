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
  isCheckboxPropertyEnabled,
  getDisplayedElement,
  clickOnDisplayedElement,
  findUrl,
  clickAndSendKeys,
  waitForNotDisplayed,
  wait
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, subscriptionUrl } from "@eyeo/test-utils/extension";
import { easylistFilter, customBlockingFilter } from "@eyeo/test-utils/filters";

import {
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  getFLSelectors,
  waitForSubscriptionUpdated,
  clickFLCheckboxAndCheck,
  getLanguageFilterLists,
  addLanguageFilterList,
  addCustomFilters,
  getCustomFilters,
  deleteCustomFilters,
  clickOnCustomFilterToggleAndCheck,
  getTooltipMsg,
  manageFilterListsError
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

export default () => {
  beforeEach(async function () {
    await initOptionsAdvancedTab(getOptionsHandle());
  });

  it("shows the built in filter list dropdown", async function () {
    const languageElems = await getLanguageFilterLists(false);

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
      await wait(
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

    try {
      // Wait for filterlists to be updated "minutes ago"
      await waitForAllUpdated(/minutes ago/, longTimeout);
      await clickOnDisplayedElement("#update");
      await waitForAllUpdated(/Just now/, 5000);
    } catch (err) {
      await manageFilterListsError(err);
    }
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
    const enabled = await isCheckboxPropertyEnabled(toggle);
    expect({ name, enabled }).toEqual({ name, enabled: true });

    // Disable FL
    await clickFLCheckboxAndCheck(toggle, {
      enable: false,
      isToggle: true,
      name
    });

    // Reenable FL
    await clickFLCheckboxAndCheck(toggle, {
      enable: true,
      isToggle: true,
      name
    });

    await waitForSubscriptionUpdated(name, { timeout: 5000 });
  });

  it("removes and adds back a filter list", async function () {
    const name = "EasyList";
    const langName = "English";
    const { filterlist, trashBtn } = getFLSelectors(name);

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
    await addLanguageFilterList(langName, { isOptionsGeneralTab: true });

    // Check EasyList on advanced tab
    await waitForSubscriptionUpdated(name, { timeout: 3000 });
  });

  it("adds and removes a built in language filter list", async function () {
    const langNameAdvancedTab = "EasyList Polish+EasyList";
    const langNameGeneralTab = "polski + English";

    // Add filterlist on advanced tab
    await addLanguageFilterList(langNameAdvancedTab, {
      isOptionsGeneralTab: false
    });

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
    await waitForNotDisplayed(filterlist, {
      timeout: 3000,
      displayedTimeout: 1000
    });
  });

  it("displays an error for invalid filter list via URL", async function () {
    const invalidSubscriptionUrl = "invalid.txt";

    await setFilterListUrl(invalidSubscriptionUrl);
    const elem = await getDisplayedElement("#filterlist-by-url .error-msg");
    expect(await elem.getText()).toEqual("URL must start with https://.");
  });

  it("adds and removes custom filters", async function () {
    await addCustomFilters([customBlockingFilter]);
    expect(await getCustomFilters()).toContain(customBlockingFilter);

    await deleteCustomFilters();
    expect(await getCustomFilters()).not.toContain(customBlockingFilter);
  });

  it("displays an error for disabled filters", async function () {
    const name = "EasyList";
    const errorMsg =
      "There are one or more issues with this filter list:\n" +
      "Some filters in this filter list are disabled.\nEnable them";
    const { toggle, tooltip } = getFLSelectors(name);

    // Check that EasyList is enabled
    let enabled = await isCheckboxPropertyEnabled(toggle);
    expect({ name, enabled }).toEqual({ name, enabled: true });

    await addCustomFilters([easylistFilter]);
    // Disable custom filter
    const customSelector = await clickOnCustomFilterToggleAndCheck(
      easylistFilter,
      { enable: false }
    );

    // Check error message
    expect(await getTooltipMsg(tooltip)).toEqual(errorMsg);

    // Reenable custom filter through tooltip link
    await clickOnDisplayedElement(`${tooltip} [data-action="enable-filters"]`);
    await waitForNotDisplayed(tooltip);
    enabled = await isCheckboxPropertyEnabled(customSelector);
    expect({ easylistFilter, enabled }).toEqual({
      easylistFilter,
      enabled: true
    });
  });
};
