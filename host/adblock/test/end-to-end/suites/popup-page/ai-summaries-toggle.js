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
  clickOnDisplayedElement,
  getDisplayedElement,
  isCheckboxPropertyEnabled,
  wait,
  waitForNotDisplayed,
} from "@eyeo/test-utils/driver";
import { getOptionsHandle, getPendingLoggerCdpEventStats } from "@eyeo/test-utils/extension";
import { beforeEachTasks } from "@eyeo/test-utils/hooks";

import {
  checkSubscriptionsState,
  clickFilterlist,
  initOptionsFiltersTab,
  initPopupWithLocalPage,
  setAiSummariesRollout,
} from "../../utils/page.js";
import { aiSummariesFilterList } from "../../utils/dataset.js";

const {
  name,
  checkboxSelector,
  popupSectionSelector,
  popupTitle,
  popupSubtitle,
  popupToggleSelector,
  popupConfirmActionSelector,
} = aiSummariesFilterList;

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
      counts = JSON.stringify((await getPendingLoggerCdpEventStats())?.counts ?? {});
      await driver.sleep(500);
      return previous === counts;
    },
    5000,
    "The behaviour event counts did not settle",
  );
  return JSON.parse(counts) || {};
}

async function waitForBehaviourCount(key, expected) {
  await driver.switchTo().window(getOptionsHandle());
  let actual;
  await wait(
    async () => {
      const stats = await getPendingLoggerCdpEventStats();
      actual = stats?.counts?.[key] ?? 0;
      return actual === expected;
    },
    5000,
    () => `The "${key}" event count was ${actual} instead of ${expected}`,
  );
}

async function enableFromPopup() {
  await initPopupWithLocalPage();
  await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
  await driver.sleep(1000);
  await clickOnDisplayedElement(`${popupSectionSelector} .title`);

  // Turning the list on first shows a confirmation page
  await wait(
    async () => {
      try {
        await clickOnDisplayedElement(popupConfirmActionSelector, { timeout: 500 });
        return true;
      } catch (e) {
        return false;
      }
    },
    5000,
    "The AI search summaries confirmation button was not clickable",
  );
  // Confirming reloads the page and closes the popup
  await driver.switchTo().window(getOptionsHandle());
}

async function ensureFilterListDisabled() {
  await initOptionsFiltersTab(getOptionsHandle());
  if (await isCheckboxPropertyEnabled(checkboxSelector)) {
    await clickFilterlist(name, checkboxSelector, false);
  }
}

export default () => {
  before(async function () {
    // The previous suite closes the options page, and suite-level hooks run
    // before the root beforeEach that would restore it
    await beforeEachTasks();
    // The AI search summaries toggle is only shown to users in the rollout
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

    const titleElem = await getDisplayedElement(`${popupSectionSelector} .title`, {
      timeout: 3000,
    });
    expect(await titleElem.getText()).toEqual(popupTitle);
    const subtitleElem = await getDisplayedElement(`${popupSectionSelector} .subtitle`);
    expect(await subtitleElem.getText()).toEqual(popupSubtitle);

    const toggle = await getDisplayedElement(popupToggleSelector);
    expect(await toggle.getAttribute("data-is-checked")).toEqual(null);
  });

  it("hides the AI search summaries option outside the rollout", async function () {
    await setAiSummariesRollout(false);

    await initPopupWithLocalPage();
    await waitForNotDisplayed(popupSectionSelector, { timeout: 3000 });
    await initOptionsFiltersTab(getOptionsHandle());
    await waitForNotDisplayed(`[name="${name}"]`);

    await setAiSummariesRollout(true);
  });

  it("keeps the row for users who turned the list on outside the rollout", async function () {
    await initOptionsFiltersTab(getOptionsHandle());
    await clickFilterlist(name, checkboxSelector, true);
    await checkSubscriptionsState([{ name, enabled: true, checkboxSelector }], {
      timeout: 5000,
      regexp: /updated|Subscribed|Fetching/,
    });

    // Leaving the rollout keeps the row, so the list can be turned off
    await setAiSummariesRollout(false);
    await initOptionsFiltersTab(getOptionsHandle());
    expect(await isCheckboxPropertyEnabled(checkboxSelector)).toEqual(true);
    await clickFilterlist(name, checkboxSelector, false);
    await checkSubscriptionsState([{ name, enabled: false, checkboxSelector }], {
      regexp: /Unsubscribed/,
    });

    await setAiSummariesRollout(true);
  });

  it("logs the telemetry events for the AI search summaries toggle", async function () {
    const counts = await getStableBehaviourCounts();
    let shown = counts[shownCountKey] ?? 0;
    let toggled = counts[toggledCountKey] ?? 0;

    // Opening the popup logs that the toggle was shown
    await initPopupWithLocalPage();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForBehaviourCount(shownCountKey, (shown += 1));

    // Turning the list on from the popup logs the change. Confirming loads
    // the popup page again without a tab, where the toggle is not shown
    await enableFromPopup();
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));
    await waitForBehaviourCount(shownCountKey, (shown += 1));

    // Turning it off from the popup logs the change
    await initPopupWithLocalPage();
    const popupHandle = await driver.getWindowHandle();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForBehaviourCount(shownCountKey, (shown += 1));
    await driver.switchTo().window(popupHandle);
    await driver.sleep(1000);
    await clickOnDisplayedElement(`${popupSectionSelector} .title`);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));

    // Turning it on and off in the Filter lists tab logs both changes too.
    // The change from the popup may still be applied when the tab opens
    await initOptionsFiltersTab(getOptionsHandle());
    await wait(
      async () => (await isCheckboxPropertyEnabled(checkboxSelector)) === false,
      5000,
      "The AI search summaries filter list was not disabled from the popup",
    );
    await clickFilterlist(name, checkboxSelector, true);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));
    await clickFilterlist(name, checkboxSelector, false);
    await waitForBehaviourCount(toggledCountKey, (toggled += 1));

    // Opening the popup again only logs that the toggle was shown
    await initPopupWithLocalPage();
    await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    await waitForBehaviourCount(shownCountKey, (shown += 1));
    await waitForBehaviourCount(toggledCountKey, toggled);
  });

  it("enables the AI search summaries filter list from the popup toggle", async function () {
    await initPopupWithLocalPage();

    const toggle = await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    expect(await toggle.getAttribute("data-is-checked")).toEqual(null);

    await driver.sleep(1000);
    await clickOnDisplayedElement(`${popupSectionSelector} .title`);

    // Like the premium toggles, turning the list on first shows a
    // confirmation page. A sliding animation makes polling needed.
    await wait(
      async () => {
        try {
          await clickOnDisplayedElement(popupConfirmActionSelector, { timeout: 500 });
          return true;
        } catch (e) {
          return false;
        }
      },
      5000,
      "The AI search summaries confirmation button was not clickable",
    );

    // Confirming reloads the page and closes the popup, so the popup is
    // opened again to check the toggle
    await driver.switchTo().window(getOptionsHandle());
    await initPopupWithLocalPage();
    const checkedToggle = await getDisplayedElement(popupToggleSelector, { timeout: 5000 });
    await wait(
      async () => (await checkedToggle.getAttribute("data-is-checked")) === "true",
      5000,
      "The AI search summaries toggle was not turned on",
    );

    await initOptionsFiltersTab(getOptionsHandle());
    await checkSubscriptionsState([{ name, enabled: true, checkboxSelector }], {
      timeout: 5000,
      regexp: /updated|Subscribed|Fetching/,
    });
  });

  it("disables the AI search summaries filter list from the popup toggle", async function () {
    await initOptionsFiltersTab(getOptionsHandle());
    await clickFilterlist(name, checkboxSelector, true);

    await initPopupWithLocalPage();
    const toggle = await getDisplayedElement(popupToggleSelector, { timeout: 3000 });
    expect(await toggle.getAttribute("data-is-checked")).toEqual("true");

    await driver.sleep(1000);
    await clickOnDisplayedElement(`${popupSectionSelector} .title`);

    // Turning the list off reloads the page and closes the popup
    await driver.switchTo().window(getOptionsHandle());
    await initOptionsFiltersTab(getOptionsHandle());
    await wait(
      async () => (await isCheckboxPropertyEnabled(checkboxSelector)) === false,
      5000,
      "The AI search summaries filter list was not disabled",
    );
  });
};
