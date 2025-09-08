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
  getDisplayedElement,
  openNewTab,
  isCheckboxPropertyEnabled,
  waitForNotDisplayed,
  wait,
} from "@eyeo/test-utils/driver";
import {
  blockHideUrl,
  aaTestPageUrl,
  customFiltersTestPageUrl,
  snippetTestPageUrl,
} from "@eyeo/test-utils/host-urls";
import { allowlistingFilter, customFilters } from "@eyeo/test-utils/host-filters";
import {
  addFiltersProgrammatically,
  getFiltersProgrammatically,
  getOptionsHandle,
  removeAllFilters,
} from "@eyeo/test-utils/extension";

import {
  checkBlockHidePage,
  setCustomFilters,
  getCustomFilters,
  initOptionsFiltersTab,
  clickFilterlist,
  setAADefaultState,
} from "../../utils/page.js";

export default () => {
  after(async function () {
    await setAADefaultState();
  });

  it("uses sitekey to allowlist content", async function () {
    const url = `https://abptestpages.org/en/exceptions/sitekey_mv${extension.manifestVersion}`;

    const getTestpagesFilters = async () => {
      await getDisplayedElement("pre");

      const filters = [];
      for (const elem of await driver.findElements(By.css("pre"))) {
        filters.push(await elem.getText());
      }

      if (filters.length === 0) {
        throw new Error(`No filters were found on ${url}`);
      }

      return filters.join("\n");
    };

    const websiteHandle = await openNewTab(url);
    // A failing element is displayed before applying the filters
    await getDisplayedElement("#sitekey-fail-1");

    const filters = await getTestpagesFilters();
    await addFiltersProgrammatically(initOptionsFiltersTab, filters);

    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();
    // A failing element is no longer displayed after applying the filters
    await waitForNotDisplayed("#sitekey-fail-1");
    await waitForNotDisplayed("#sitekey-fail-2");
    await getDisplayedElement("#sitekey-area > div.testcase-examplecontent");

    await driver.switchTo().frame("sitekey-frame");
    await getDisplayedElement("#inframe-target");
    if (extension.manifestVersion === 3) {
      await waitForNotDisplayed("#inframe-image");
    } else {
      await getDisplayedElement("#inframe-image");
    }

    await driver.switchTo().window(getOptionsHandle());
    await removeAllFilters();
  });

  it("blocks and hides ads", async function () {
    await openNewTab(blockHideUrl);
    await checkBlockHidePage(false);
  });

  it("uses snippets to block ads", async function () {
    await openNewTab(snippetTestPageUrl);
    await waitForNotDisplayed("#snippet-filter", { timeout: 2000 });
    await getDisplayedElement("#control-element");
  });

  it("uses custom filters to block ads", async function () {
    await openNewTab(customFiltersTestPageUrl);
    const customIdELem = await getDisplayedElement("#test-element-id-custom");
    const customClassElem = await getDisplayedElement(".test-element-class-custom");
    const customScriptPathElem = await getDisplayedElement("#script-id-custom-full-path");
    const customScriptRegexElem = await getDisplayedElement("#script-id-custom-regex");
    expect(await customIdELem.getText()).toEqual("Custom id hiding filter not applied");
    expect(await customClassElem.getText()).toEqual("Custom css hiding filter not applied");
    expect(await customScriptPathElem.getText()).toEqual("Custom blocking filter not applied");
    expect(await customScriptRegexElem.getText()).toEqual(
      "Custom regex blocking filter not applied",
    );

    const splitCustomFilters = customFilters.join("\n");
    await setCustomFilters([splitCustomFilters]);
    expect(await getCustomFilters()).toEqual(customFilters);

    await openNewTab(customFiltersTestPageUrl);
    await driver.navigate().refresh();
    await waitForNotDisplayed("#test-element-id-custom", { timeout: 3000 });
    await waitForNotDisplayed(".test-element-class-custom", { timeout: 3000 });
    await waitForNotDisplayed("#script-id-custom-full-path", { timeout: 3000 });
    await waitForNotDisplayed("#script-id-custom-regex", { timeout: 3000 });
    await getDisplayedElement("#control-element");
  });

  it("allowlists websites", async function () {
    await addFiltersProgrammatically(initOptionsFiltersTab, allowlistingFilter);
    expect(await getFiltersProgrammatically(initOptionsFiltersTab)).toContain(allowlistingFilter);

    const websiteHandle = await openNewTab(blockHideUrl);
    await checkBlockHidePage(true);
    await setCustomFilters([]);
    await driver.switchTo().window(websiteHandle);
    await checkBlockHidePage(false);
  });

  it("displays acceptable ads", async function () {
    const visibleSelector = "#control-element";
    const hiddenSelector = "#test-aa";
    const aaFLButtonSelector = "#adblockFilterList_0";

    await initOptionsFiltersTab(getOptionsHandle());
    await wait(
      async () => isCheckboxPropertyEnabled(aaFLButtonSelector),
      2000,
      `Acceptable Ads is not enabled by default`,
    );
    const websiteHandle = await openNewTab(aaTestPageUrl);
    await getDisplayedElement(hiddenSelector);
    await getDisplayedElement(visibleSelector);

    await initOptionsFiltersTab(getOptionsHandle());
    await clickFilterlist("acceptable_ads", aaFLButtonSelector, false);
    await driver.switchTo().window(websiteHandle);
    await wait(
      async () => {
        try {
          await getDisplayedElement(visibleSelector, { timeout: 3000, forceRefresh: true });
          await waitForNotDisplayed(hiddenSelector, { forceRefresh: true });
          return true;
        } catch (e) {}
      },
      8000,
      "The AA element is still in unexpected state after 8000 ms",
    );
  });
};
