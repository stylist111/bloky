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
  getDisplayedElement,
  isCheckboxAttributeEnabled,
  wait,
  waitForNotDisplayed
} from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  getPendingLoggerCdpEventStats
} from "@eyeo/test-utils/extension";

import {
  addLanguageFilterList,
  checkSubscriptionsState,
  getElemTextSafe,
  getFLSelectors,
  getLanguageFilterLists,
  initOptionsAdvancedTab,
  initOptionsGeneralTab,
  initPopupPage,
  initPopupWithLocalPage,
  isFLInCorrectState,
  clickFLAndCheck,
  setAiSummariesRollout
} from "../utils/page.js";
import { aiSummariesFilterList } from "../utils/dataset.js";

const { name, title, popupTitle, popupContainerSelector, popupToggleSelector } =
  aiSummariesFilterList;
const generalTabRowSelector = `#free-list-table li[aria-label="${name}"]`;
const generalTabCheckboxSelector = `${generalTabRowSelector} button`;

async function waitForToggleState(enabled) {
  await wait(
    async () =>
      (await isCheckboxAttributeEnabled(popupToggleSelector)) === enabled,
    3000,
    `The AI search summaries toggle was not ${enabled ? "enabled" : "disabled"}`
  );
}

const toggledCountKey = "extensions_ui:ai_summaries_toggled";
const shownCountKey = "extensions_ui:ai_summaries_toggle_shown";

// Behaviour event counts are written to storage with a delay, so the
// baseline is only taken once two consecutive reads match
async function getStableBehaviourCounts() {
  await driver.switchTo().window(getOptionsHandle());
  let previous = null;
  let counts = null;
  await wait(
    async () => {
      previous = counts;
      counts = JSON.stringify(
        (await getPendingLoggerCdpEventStats())?.counts ?? {}
      );
      await driver.sleep(500);
      return previous === counts;
    },
    5000,
    "The behaviour event counts did not settle"
  );
  return JSON.parse(counts) || {};
}

// The counts are read from the options page, unless the popup must stay
// open (it closes itself when another tab is activated), in which case
// they are read from the popup page, which is an extension page too
async function waitForBehaviourCount(
  key,
  expected,
  { fromCurrentPage = false } = {}
) {
  if (!fromCurrentPage) {
    await driver.switchTo().window(getOptionsHandle());
  }
  let actual;
  await wait(
    async () => {
      const stats = await getPendingLoggerCdpEventStats();
      actual = stats?.counts?.[key] ?? 0;
      return actual === expected;
    },
    5000,
    () => `The "${key}" event count was ${actual} instead of ${expected}`
  );
}

async function ensureFilterListDisabled() {
  // Subscriptions can only be queried from an extension page
  await initOptionsGeneralTab(getOptionsHandle());
  if (await isFLInCorrectState(title, { enable: true })) {
    await clickFLAndCheck(name, { enable: false });
  }
}

export default () => {
  before(async function () {
    // The AI search summaries option is only shown to users in the rollout
    await setAiSummariesRollout(true);
  });

  beforeEach(async function () {
    await ensureFilterListDisabled();
  });

  after(async function () {
    await ensureFilterListDisabled();
    await setAiSummariesRollout(false);
  });

  it("shows the AI search summaries toggle off by default", async function () {
    await initPopupWithLocalPage();

    await getDisplayedElement(popupContainerSelector);
    const titleElem = await getDisplayedElement(
      `${popupContainerSelector} [data-i18n="ai_summaries_title"]`
    );
    expect(await titleElem.getText()).toEqual(popupTitle);

    const labelElem = await getDisplayedElement(
      `${popupContainerSelector} [data-i18n="ai_summaries_new_label"]`
    );
    expect((await labelElem.getText()).toLowerCase()).toEqual("new");

    expect(await isCheckboxAttributeEnabled(popupToggleSelector)).toEqual(
      false
    );
  });

  it("hides the AI search summaries toggle on pages the extension cannot act on", async function () {
    const counts = await getStableBehaviourCounts();
    const shown = counts[shownCountKey] ?? 0;

    // Without a tab id the popup behaves as on a non-http page
    await initPopupPage();
    await waitForNotDisplayed(popupContainerSelector);

    // The toggle is not reported as shown either
    await driver.sleep(1000);
    await waitForBehaviourCount(shownCountKey, shown);
  });

  it("enables and disables the AI search summaries filter list from the popup", async function () {
    await initPopupWithLocalPage();

    // Clicking right after the popup is loaded may be ineffective
    await driver.sleep(1000);

    // Turning the toggle on subscribes to the filter list
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(true);
    await checkSubscriptionsState([{ name: title, enabled: true }], {
      timeout: 5000,
      regexp: /Just now|minutes ago|Updating/
    });

    // The popup reflects the subscription state when opened again
    await initPopupWithLocalPage();
    await waitForToggleState(true);

    // Turning the toggle off removes the subscription
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(false);
    await initOptionsAdvancedTab(getOptionsHandle());
    await waitForNotDisplayed(getFLSelectors(title).filterlist, {
      timeout: 5000
    });
  });

  it("asks to reload the page after the toggle was changed from the popup", async function () {
    await initPopupWithLocalPage();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForNotDisplayed("#page-refresh");

    await driver.sleep(1000);
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(true);
    await getDisplayedElement("#page-refresh", { timeout: 3000 });

    // Changing it back removes the prompt again
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(false);
    await waitForNotDisplayed("#page-refresh", { timeout: 3000 });
  });

  it("reflects the options page state in the popup", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await clickFLAndCheck(name, { enable: true });

    // A change made on the options page needs no reload prompt
    await initPopupWithLocalPage();
    await waitForToggleState(true);
    await waitForNotDisplayed("#page-refresh");
  });

  it("hides the AI search summaries option outside the rollout", async function () {
    await setAiSummariesRollout(false);

    await initPopupWithLocalPage();
    await waitForNotDisplayed(popupContainerSelector);
    await initOptionsGeneralTab(getOptionsHandle());
    await waitForNotDisplayed(generalTabRowSelector);

    // The list is not offered in the Advanced tab's built-in lists either
    await initOptionsAdvancedTab(getOptionsHandle());
    const builtInListElems = await getLanguageFilterLists(false);
    const builtInLists = [];
    for (const elem of builtInListElems) {
      builtInLists.push(await getElemTextSafe(elem));
    }
    expect(builtInLists).not.toContainEqual(expect.stringContaining(title));

    await setAiSummariesRollout(true);
  });

  it("logs the telemetry events for the AI search summaries toggle", async function () {
    const counts = await getStableBehaviourCounts();
    let shown = counts[shownCountKey] ?? 0;
    let toggled = counts[toggledCountKey] ?? 0;

    // Opening the popup logs that the toggle was shown, and turning it on
    // and off logs both changes. The popup logs the change after the
    // subscription change was applied, so the counts are read before
    // leaving it
    await initPopupWithLocalPage();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForBehaviourCount(shownCountKey, (shown += 1), {
      fromCurrentPage: true
    });
    await driver.sleep(1000);
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(true);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1), {
      fromCurrentPage: true
    });
    await clickOnDisplayedElement(popupToggleSelector);
    await waitForToggleState(false);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1), {
      fromCurrentPage: true
    });

    // Turning it on and off in the General tab logs both changes too
    await initOptionsGeneralTab(getOptionsHandle());
    await clickFLAndCheck(name, { enable: true });
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));
    await checkSubscriptionsState([{ name: title, enabled: true }], {
      timeout: 5000,
      regexp: /Just now|minutes ago|Updating/
    });
    await initOptionsGeneralTab(getOptionsHandle());
    await clickFLAndCheck(name, { enable: false });
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));

    // Adding it from the Advanced tab's built-in lists, turning it off there
    // and removing it log each change too
    await initOptionsAdvancedTab(getOptionsHandle());
    await addLanguageFilterList(title, { isOptionsGeneralTab: false });
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));
    const { toggle: advancedToggle, trashBtn } = getFLSelectors(title);
    await initOptionsAdvancedTab(getOptionsHandle());
    await clickOnDisplayedElement(advancedToggle);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));
    await initOptionsAdvancedTab(getOptionsHandle());
    await clickOnDisplayedElement(trashBtn, { timeout: 4000 });
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));

    // Opening the popup again only logs that the toggle was shown
    await initPopupWithLocalPage();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForBehaviourCount(shownCountKey, (shown += 1));
    await waitForBehaviourCount(toggledCountKey, toggled);
  });

  it("keeps the option for users who turned the list on outside the rollout", async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await clickFLAndCheck(name, { enable: true });
    await checkSubscriptionsState([{ name: title, enabled: true }], {
      timeout: 5000,
      regexp: /Just now|minutes ago|Updating/
    });

    // Leaving the rollout keeps the row, so the list can be turned off
    await setAiSummariesRollout(false);
    await initOptionsGeneralTab(getOptionsHandle());
    expect(
      await isCheckboxAttributeEnabled(generalTabCheckboxSelector)
    ).toEqual(true);
    await clickFLAndCheck(name, { enable: false });
    expect(await isFLInCorrectState(title, { enable: true })).toEqual(false);

    await setAiSummariesRollout(true);
  });
};
