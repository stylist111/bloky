/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
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
import {
  getDisplayedElement,
  openNewTab,
  wait,
  waitForAssertion,
  waitForNotDisplayed,
} from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  removeAllFilters,
  sendExtMessage,
  setRemoteConfigExperiments,
  setRemoteConfigUrl,
  syncRemoteConfig,
} from "@eyeo/test-utils/extension";
import {
  customFilters as hostCustomFilters,
  experimentFilters,
} from "@eyeo/test-utils/host-filters";
import { experimentFiltersTestPageUrl } from "@eyeo/test-utils/host-urls";

import {
  getCustomFilters,
  initOptionsCustomizeTab,
  initOptionsGeneralTab,
  initOptionsSupportTab,
  setCustomFilters,
  waitForExtensionStateLoaded,
} from "../../utils/page.js";

const experimentFlagId = "test:filters";

async function getAdFilteringState() {
  return sendExtMessage(initOptionsGeneralTab, { command: "getAdFilteringState" });
}

function getCountForLabel(label) {
  return driver.executeScript((lbl) => {
    const dts = [...document.querySelectorAll("#extension-state dl dt")];
    const dt = dts.find((el) => el.textContent === lbl);
    return dt?.nextElementSibling?.textContent ?? null;
  }, label);
}

export default () => {
  before(async function () {
    await setRemoteConfigExperiments(getOptionsHandle, [
      {
        experimentId: "filter-experiment",
        variants: [
          {
            variantId: "enabled",
            mods: [0, 1000],
            flags: { [experimentFlagId]: experimentFilters },
          },
        ],
      },
    ]);
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await syncRemoteConfig(initOptionsGeneralTab);
    await wait(
      async () => {
        const state = await getAdFilteringState();
        return state?.experimentFiltersCount === experimentFilters.length;
      },
      5000,
      "Experiment filters were not added in time",
    );
    await setCustomFilters([hostCustomFilters[0]]);
    await getDisplayedElement("#btnEditAdvancedFilters", { timeout: 5000 });
  });

  after(async function () {
    await initOptionsCustomizeTab(getOptionsHandle());
    await removeAllFilters();
    await setRemoteConfigExperiments(getOptionsHandle, []);
    await syncRemoteConfig(initOptionsGeneralTab);
  });

  beforeEach(async function () {
    // Each test that reads custom filters expects the options Customize tab to
    // be the active window. Establish it explicitly so tests don't depend on
    // the order they run in or on state left behind by a previous test.
    await initOptionsCustomizeTab(getOptionsHandle());
  });

  it("does not show experiment filters in the Customize tab", async function () {
    const currentFilters = await getCustomFilters();

    expect(currentFilters).toContain(hostCustomFilters[0]);
    for (const filter of experimentFilters) {
      expect(currentFilters).not.toContain(filter);
    }
  });

  it("shows custom filters that have no metadata", async function () {
    // Whilst most custom filters today have metadata attached, the default state is without any metadata.
    // This test asserts that adding a filter directly via ewe.filters.add with no metadata still
    // appears in the Customize tab.
    const legacyFilter = "testpages.eyeo.com##.legacy-no-metadata-filter";

    await sendExtMessage(initOptionsGeneralTab, {
      type: "testing.addFilter",
      text: legacyFilter,
    });

    await waitForAssertion(
      async () => {
        await initOptionsCustomizeTab(getOptionsHandle());
        const currentFilters = await getCustomFilters();
        expect(currentFilters).toContain(legacyFilter);
      },
      5000,
      500,
    );
  });

  it("surfaces an error when a user tries to add an active experiment filter as a custom filter", async function () {
    // Try to add an already-active experiment filter through the Customize tab.
    // It exists as an experiment-origin user filter, so saving must surface an
    // error instead of taking it on as a custom filter.
    await setCustomFilters([experimentFilters[0], hostCustomFilters[0]]);

    const errorElem = await getDisplayedElement("#messagecustom", { timeout: 5000 });
    expect(await errorElem.getText()).toContain("already active as part of an experiment");

    await getDisplayedElement("#btnSaveAdvancedFilters");
  });

  it("shows correct User Filters count in the support tab", async function () {
    await initOptionsSupportTab(getOptionsHandle());
    await waitForExtensionStateLoaded();

    await waitForAssertion(
      async () => {
        const userFiltersCell = await getCountForLabel("User Filters");

        // Format: "<total> (experiment: <experimentCount>)" once experiment
        // filters exist; falls back to just "<total>" when there are none.
        expect(userFiltersCell).toMatch(
          new RegExp(`^\\d+ \\(experimental: ${experimentFilters.length}\\)$`),
        );
      },
      10000,
      200,
      { forceRefresh: true },
    );
  });

  it("hides page elements using experiment filters", async function () {
    const websiteHandle = await openNewTab(experimentFiltersTestPageUrl);

    await getDisplayedElement("#control-element");
    await waitForNotDisplayed("#experiment-filter-id", { timeout: 5000, forceRefresh: true });
    await waitForNotDisplayed(".experiment-filter-class", { timeout: 5000, forceRefresh: true });

    // Disabling the experiment removes its filters, so the previously hidden
    // elements should be displayed again once the page is reloaded.
    await setRemoteConfigExperiments(getOptionsHandle, []);
    await syncRemoteConfig(initOptionsGeneralTab);
    await wait(
      async () => {
        const state = await getAdFilteringState();
        return state?.experimentFiltersCount === 0;
      },
      5000,
      "Experiment filters were not removed in time",
    );

    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();
    await getDisplayedElement("#experiment-filter-id", { timeout: 5000 });
    await getDisplayedElement(".experiment-filter-class", { timeout: 5000 });
    await getDisplayedElement("#control-element");
  });
  // Keep this test last ^: it disables the experiment, so any test running after
  // it would no longer have the experiment filters set up by the before hook.
};
