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
  getDisplayedElement,
  openNewTab,
  wait,
  waitForAssertion,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import { experimentFiltersTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  getOptionsHandle,
  sendExtMessage,
  addFiltersProgrammatically,
  removeAllFilters,
  removeFilterProgrammatically,
  setRemoteConfigExperiments,
  setRemoteConfigUrl,
  syncRemoteConfig
} from "@eyeo/test-utils/extension";
import {
  customFilters,
  experimentFilters
} from "@eyeo/test-utils/host-filters";

import {
  getCustomFilters,
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  initOptionsHelpTab,
  addCustomFilters
} from "../../utils/page.js";

const experimentFlagId = "test:filters";
const totalUserFilters = customFilters.length + experimentFilters.length;

function getAdFilteringState() {
  return sendExtMessage(initOptionsGeneralTab, {
    type: "app.getAdFilteringState"
  });
}

async function waitForExtensionStateLoaded() {
  await wait(
    async () => {
      const text = await driver.executeScript(
        () => document.querySelector("#extension-state")?.textContent
      );
      return text && !text.includes("Loading");
    },
    8000,
    "Extension state did not finish loading"
  );
}

function getTotalValue(label) {
  return driver.executeScript((text) => {
    const terms = [...document.querySelectorAll("#extension-state dl dt")];
    const term = terms.find((el) => el.textContent === text);
    return term?.nextElementSibling?.textContent ?? null;
  }, label);
}

export default () => {
  before(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await removeAllFilters();

    await setRemoteConfigExperiments(getOptionsHandle, [
      {
        experimentId: "filter-experiment",
        variants: [
          {
            variantId: "enabled",
            mods: [0, 1000],
            flags: { [experimentFlagId]: experimentFilters }
          }
        ]
      }
    ]);
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await syncRemoteConfig(initOptionsGeneralTab);

    await addFiltersProgrammatically(
      getOptionsHandle,
      customFilters.join("\n")
    );

    // Wait until the background reports exactly the filters we set up, so the
    // Help tab assertion below is deterministic rather than racing the syncs.
    await wait(
      async () => {
        const state = await getAdFilteringState();
        return (
          state?.experimentFiltersCount === experimentFilters.length &&
          state?.userFiltersCount === totalUserFilters
        );
      },
      8000,
      "Custom and experiment filters were not set up with the expected counts"
    );

    // reload the option page after applying filters to avoid stale state.
    await driver.navigate().refresh();
  });

  after(async function () {
    await setRemoteConfigExperiments(getOptionsHandle, []);
    await syncRemoteConfig(initOptionsGeneralTab);
    await initOptionsGeneralTab(getOptionsHandle());
    await removeAllFilters();
  });

  it("does not show experiment filters in the custom filters list", async function () {
    await initOptionsAdvancedTab(getOptionsHandle());

    // Poll the freshly populated list: our custom filters must render and no
    // experiment filter may leak in.
    await waitForAssertion(
      async () => {
        const currentFilters = await getCustomFilters();

        for (const filter of customFilters) {
          expect(currentFilters).toContain(filter);
        }
        for (const filter of experimentFilters) {
          expect(currentFilters).not.toContain(filter);
        }
      },
      10000,
      500
    );
  });

  it("shows custom filters that have no metadata", async function () {
    // A filter added directly via ewe.filters.add has no metadata. Only
    // experiment-origin filters are meant to be hidden, so a metadata-less
    // filter must still appear in the custom filters list.
    const noMetaDataFilter = "testpages.eyeo.com##.no-metadata-filter";

    await sendExtMessage(initOptionsGeneralTab, {
      type: "testing.addFilter",
      text: noMetaDataFilter
    });

    try {
      // The filter was added after test setup, so reload once to repopulate the
      // list from the current filters, then poll until it renders.
      await driver.navigate().refresh();
      await initOptionsAdvancedTab(getOptionsHandle());

      await waitForAssertion(
        async () => {
          const currentFilters = await getCustomFilters();
          expect(currentFilters).toContain(noMetaDataFilter);
        },
        10000,
        500
      );
    } finally {
      // Remove only the legacy filter so other tests' filter counts are
      // unaffected, regardless of execution order.
      await removeFilterProgrammatically(
        initOptionsGeneralTab,
        noMetaDataFilter
      );
    }
  });

  it("surfaces an error when adding an active experiment filter as a custom filter", async function () {
    try {
      await addCustomFilters([experimentFilters[0]], {
        switchToAdvancedTab: true,
        checkFilterIsShown: false
      });

      const errorElem = await getDisplayedElement(
        "#custom-filters io-filter-table .footer .error",
        { timeout: 5000 }
      );
      expect(await errorElem.getText()).toContain(
        "already active as part of an experiment"
      );

      // The filter must not have been taken on as a custom filter.
      const currentFilters = await getCustomFilters();
      expect(currentFilters).not.toContain(experimentFilters[0]);
    } finally {
      // Reload to clear the typed-in filter and the visible error.
      await driver.navigate().refresh();
    }
  });

  it("shows the user filter total and experiment count in the Help tab", async function () {
    await waitForAssertion(
      async () => {
        await initOptionsHelpTab(getOptionsHandle());
        await waitForExtensionStateLoaded();

        // The total counts every user filter, including the experiment ones,
        // with the experiment subset shown in parentheses.
        const userFiltersValue = await getTotalValue("User Filters");
        expect(userFiltersValue).toEqual(
          `${totalUserFilters} (experimental: ${experimentFilters.length})`
        );
      },
      10000,
      500
    );
  });

  it("hides page elements using experiment filters", async function () {
    const websiteHandle = await openNewTab(experimentFiltersTestPageUrl);

    await getDisplayedElement("#control-element");
    await waitForNotDisplayed("#experiment-filter-id", {
      timeout: 5000,
      forceRefresh: true
    });
    await waitForNotDisplayed(".experiment-filter-class", {
      timeout: 5000,
      forceRefresh: true
    });

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
      "Experiment filters were not removed in time"
    );

    await driver.switchTo().window(websiteHandle);
    await driver.navigate().refresh();
    await getDisplayedElement("#experiment-filter-id", { timeout: 5000 });
    await getDisplayedElement(".experiment-filter-class", { timeout: 5000 });
    await getDisplayedElement("#control-element");
  });
  // Keep this test last ^: it disables the experiment, so any test running
  // after it would no longer have the experiment filters set up by the before
  // hook.
};
