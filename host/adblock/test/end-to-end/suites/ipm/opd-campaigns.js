/* eslint-disable camelcase */
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
  getOptionsHandle,
  updateSettings,
  setRemoteConfigUrl,
  syncRemoteConfig,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment,
  clearDismissedIpmIds,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats,
} from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  waitForNotDisplayed,
  findUrl,
  openNewTab,
} from "@eyeo/test-utils/driver";
import { premiumUrl } from "../../utils/urls.js";
import {
  commandReceivedEvent,
  opdCommandReadyEvent,
  opdDialogClickedEvent,
  opdDialogClosedEvent,
  opdDialogIgnoredEvent,
  opdDialogInjectedEvent,
} from "../../utils/events.js";
import { expectedIPMCommands } from "../../utils/ipms.js";
import { initOptionsGeneralTab } from "../../utils/page.js";

async function getOPDShadowRoot() {
  // #__ABoverlay is actually not displayed on the page (hence checkDisplayed: false)
  // We just need to check that it was appended by the extension and is present in DOM
  await getDisplayedElement("#__ABoverlay", {
    timeout: 4000,
    checkDisplayed: false,
  });
  const opdHost = await driver.findElement(By.css("#__ABoverlay"));
  return opdHost.getShadowRoot();
}

export default (fragmentType) => {
  before(async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setIPMCooldowns(initOptionsGeneralTab);

    // `suppress_update_page` must be set to false before running tests,
    // so that newtabs can be triggered. This setting is otherwise set to true
    // to prevent real newtab IPMs from opening and interfering with the tests.
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", false);

    await setIPMFragment(getOptionsHandle, fragmentType);
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
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
    await resetIPMFragment(getOptionsHandle);
  });

  it("triggers an OPD campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblock_navigation_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation[fragmentType]);

    await openNewTab("https://www.example.com");

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD navigation title");
    expect(await ctaButton.getText()).toEqual("CTA navigation");
    expect(texts[0]).toEqual("This is a test OPD based on navigation");
    expect(texts[1]).toEqual("ipmID: test_adblock_navigation");

    await ctaButton.click();
    await findUrl(premiumUrl);
    await openNewTab("https://www.wikipedia.org");
    await waitForNotDisplayed("#__ABoverlay");

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
        "received",
        "error_no_behavior",
        "dialog_injected",
        "dialog_button_clicked",
        "error_no_behavior",
      ]);
    } else if (fragmentType === "future") {
      await initOptionsGeneralTab(getOptionsHandle());
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblock_navigation_future";
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
      `test_adblock_exclusion_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.exclusion[fragmentType]);

    await openNewTab("https://www.example.com");
    await waitForNotDisplayed("#__ABoverlay");

    await openNewTab("https://www.wikipedia.org");
    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD exclusion title");
    expect(await ctaButton.getText()).toEqual("CTA exclusion");
    expect(texts[0]).toEqual("This is a test OPD based on exclusion");
    expect(texts[1]).toEqual("ipmID: test_adblock_exclusion");

    await driver.navigate().refresh();
    await waitForNotDisplayed("#__ABoverlay");

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
        "received",
        "error_no_behavior",
        "dialog_injected",
        "error_no_behavior",
        "dialog_injected",
      ]);
    } else if (fragmentType === "future") {
      await initOptionsGeneralTab(getOptionsHandle());
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblock_exclusion_future";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
      expect(counts).not.toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`);
      expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
      expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
    }
  });

  it("triggers an OPD campaign cookie", async function () {
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, `test_adblock_cookie_${fragmentType}`);
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cookie[fragmentType]);

    await openNewTab("https://www.example.com");
    await waitForNotDisplayed("#__ABoverlay");

    await openNewTab("https://www.welt.de");
    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD cookie title");
    expect(await ctaButton.getText()).toEqual("CTA cookie");
    expect(texts[0]).toEqual("This is a test cookie baner OPD");
    expect(texts[1]).toEqual("ipmID: test_adblock_cookie");
  });
};
