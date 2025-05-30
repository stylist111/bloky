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
  openNewTab,
  getDisplayedElement,
  waitForNotDisplayed,
  wait
} from "@eyeo/test-utils/driver";
import {
  aaTestPageUrl,
  blockHideUrl,
  snippetTestPageUrl
} from "@eyeo/test-utils/urls";
import { snippetFilter, allowlistedDomain } from "@eyeo/test-utils/filters";
import {
  initOptionsGeneralTab,
  checkBlockHidePage,
  setAADefaultState,
  clickFLCheckboxAndCheck,
  addCustomFilters,
  addAllowlistFilters,
  deleteFirstAllowlistFilter
} from "../../utils/page.js";
import {
  getOptionsHandle,
  removeAllFilters,
  addFiltersProgrammatically
} from "@eyeo/test-utils/extension";

export default () => {
  after(async function () {
    await setAADefaultState();
    await removeAllFilters();
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
    await addFiltersProgrammatically(initOptionsGeneralTab, filters);

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
  });

  it("blocks and hides ads", async function () {
    await openNewTab(blockHideUrl);
    await checkBlockHidePage(false);
  });

  it("uses snippets to block ads", async function () {
    await openNewTab(snippetTestPageUrl);
    const snippetElem = await getDisplayedElement("#snippet-filter");
    expect(await snippetElem.getText()).toEqual("Snippet filter not applied");

    await addCustomFilters([snippetFilter], { switchToAdvancedTab: true });
    await openNewTab(snippetTestPageUrl);
    await driver.navigate().refresh();
    await waitForNotDisplayed("#snippet-filter", { timeout: 2000 });
    await getDisplayedElement("#control-element");
  });

  it("allowlists websites", async function () {
    await addAllowlistFilters([allowlistedDomain]);
    const websiteHandle = await openNewTab(blockHideUrl);
    await checkBlockHidePage(true);
    await deleteFirstAllowlistFilter();
    await driver.switchTo().window(websiteHandle);
    await checkBlockHidePage(false);
  });

  it("displays acceptable ads", async function () {
    const visibleSelector = "#control-element";
    const hiddenSelector = "#test-aa";

    await setAADefaultState();

    const websiteHandle = await openNewTab(aaTestPageUrl);
    await getDisplayedElement(hiddenSelector);
    await getDisplayedElement(visibleSelector);

    await initOptionsGeneralTab(getOptionsHandle());
    await clickFLCheckboxAndCheck("#acceptable-ads-allow", {
      enable: false,
      name: "Acceptable Ads"
    });

    await driver.switchTo().window(websiteHandle);
    await wait(
      async () => {
        await driver.navigate().refresh();
        try {
          await getDisplayedElement(visibleSelector);
          await waitForNotDisplayed(hiddenSelector);
          return true;
        } catch (e) {}
      },
      8000,
      "The AA element is still in unexpected state after 8000 ms"
    );
  });
};
