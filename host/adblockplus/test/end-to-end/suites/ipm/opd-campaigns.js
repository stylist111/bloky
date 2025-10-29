/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2025-present eyeo GmbH
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

/* eslint-disable camelcase */

import { expect } from "expect";
import { By } from "selenium-webdriver";

import {
  getOptionsHandle,
  updatePrefs,
  syncRemoteConfig,
  setRemoteConfigIpmCommands,
  setRemoteConfigUrl,
  clearDismissedIpmIds,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats
} from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  waitForNotDisplayed,
  findUrl,
  openNewTab
} from "@eyeo/test-utils/driver";
import { updateUrlNavigation } from "../../utils/urls.js";
import {
  commandReceivedEvent,
  opdCommandReadyEvent,
  opdDialogClickedEvent,
  opdDialogClosedEvent,
  opdDialogIgnoredEvent,
  opdDialogInjectedEvent
} from "../../utils/events.js";
import { expectedIPMCommands } from "../../utils/ipms.js";
import { initOptionsGeneralTab } from "../../utils/page.js";

async function switchToOPDiframe() {
  // #__abp-overlay-onpage-dialog is actually not displayed on the page (hence checkDisplayed: false)
  // We just need to check that it was appended by the extension and is present in DOM
  const iframe = await getDisplayedElement(
    "#__abp-overlay-onpage-dialog iframe",
    {
      timeout: 4000,
      checkDisplayed: false
    }
  );
  await driver.switchTo().frame(iframe);
}

export default (fragmentType) => {
  before(async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }
    await setIPMCooldowns(initOptionsGeneralTab);

    // `suppress_first_run_page` must be set to false before running tests,
    // so that newtabs can be triggered. This setting is otherwise set to true
    // to prevent real newtab IPMs from opening and interfering with the tests.
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", false);

    await setIPMFragment(initOptionsGeneralTab, fragmentType);
  });

  beforeEach(async function () {
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await clearDismissedIpmIds(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await clearRemoteConfigIpmCommands(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
    await resetIPMFragment(initOptionsGeneralTab);
  });

  it("triggers an OPD campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblockplus_navigation_${fragmentType}`
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation[fragmentType]);
    await openNewTab("https://www.example.com");

    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD navigation title");
    expect(await ctaButton.getText()).toEqual("CTA NAVIGATION");
    expect(texts[0]).toEqual("This is a test OPD based on navigation");
    expect(texts[1]).toEqual("ipmID: test_adblockplus_navigation");

    await ctaButton.click();
    await driver.switchTo().defaultContent();

    await findUrl(updateUrlNavigation);
    await openNewTab("https://www.example.net");
    await waitForNotDisplayed("#__abp-overlay-onpage-dialog iframe");

    await initOptionsGeneralTab(getOptionsHandle());
    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    // Legacy fragment uses ping payloads, future fragment uses CDP
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
      const actions = pingPayload.events.map((e) => e.action);

      // See: https://eyeo.atlassian.net/browse/IM-217
      // for context on error_no_behavior events
      expect(actions).toEqual([
        "error_no_behavior",
        "dialog_injected",
        "dialog_button_clicked",
        "error_no_behavior"
      ]);
    } else if (fragmentType === "future") {
      await initOptionsGeneralTab(getOptionsHandle());
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblockplus_navigation_future";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`, 1);
      expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
      expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
    }
  });

  it("triggers an OPD campaign exclusion and dismissed after page reload", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblockplus_exclusion_${fragmentType}`
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.exclusion[fragmentType]);

    await openNewTab("https://www.example.org");
    await waitForNotDisplayed("#__abp-overlay-onpage-dialog iframe");

    await openNewTab("https://www.wikipedia.org");
    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD exclusion title");
    expect(await ctaButton.getText()).toEqual("CTA EXCLUSION");
    expect(texts[0]).toEqual("This is a test OPD based on exclusion");
    expect(texts[1]).toEqual("ipmID: test_adblockplus_exclusion");

    await driver.navigate().refresh();
    await waitForNotDisplayed("#__abp-overlay-onpage-dialog iframe");

    await initOptionsGeneralTab(getOptionsHandle());

    // Legacy fragment uses ping payloads, future fragment uses CDP
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);

      // See: https://eyeo.atlassian.net/browse/IM-217
      // for context on error_no_behavior events
      expect(actions).toEqual([
        "error_no_behavior",
        "error_no_behavior",
        "dialog_injected"
      ]);
    } else if (fragmentType === "future") {
      await initOptionsGeneralTab(getOptionsHandle());
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblockplus_exclusion_future";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
      expect(counts).not.toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`);
      expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
      expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
    }
  });

  it("triggers an OPD campaign cookie", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblockplus_cookie_${fragmentType}`
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cookie[fragmentType]);

    await openNewTab("https://www.example.org");
    await waitForNotDisplayed("#__abp-overlay-onpage-dialog iframe");

    await openNewTab("https://www.welt.de");
    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD cookie title");
    expect(await ctaButton.getText()).toEqual("CTA COOKIE");
    expect(texts[0]).toEqual("This is a test cookie baner OPD");
    expect(texts[1]).toEqual("ipmID: test_adblockplus_cookie");
  });
};
