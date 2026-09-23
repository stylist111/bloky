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
  setRemoteConfigExperiments,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  clearDismissedIpmIds,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats,
  waitForIpmCooldown,
  overrideLanguageForIpmContent,
} from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  waitForNeverDisplayed,
  findUrl,
  openNewTab,
  navigateTo,
} from "@eyeo/test-utils/driver";
import { localTestPageUrl, testPageUrl, cookieBannerTestPageUrl } from "@eyeo/test-utils/host-urls";
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
import { initOptionsGeneralTab, setMarketingOptOutState } from "../../utils/page.js";

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

export default () => {
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
  });

  beforeEach(async function () {
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await clearDismissedIpmIds(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await setMarketingOptOutState(false);
    await clearRemoteConfigIpmCommands(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
  });

  it("triggers an OPD campaign", async function () {
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_navigation");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);

    await openNewTab(localTestPageUrl);

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
    await openNewTab(testPageUrl);
    await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });

    await initOptionsGeneralTab(getOptionsHandle());
    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await initOptionsGeneralTab(getOptionsHandle());
    const { counts } = await getPendingLoggerCdpEventStats();

    const ipmId = "test_adblock_navigation";
    expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`, 1);
    expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
  });

  it("triggers an OPD campaign exclusion and dismissed after page reload", async function () {
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_exclusion");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.exclusion);

    await openNewTab(localTestPageUrl);
    await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });

    await openNewTab(testPageUrl);
    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("OPD exclusion title");
    expect(await ctaButton.getText()).toEqual("CTA exclusion");
    expect(texts[0]).toEqual("This is a test OPD based on exclusion");
    expect(texts[1]).toEqual("ipmID: test_adblock_exclusion");

    // After successfully showing the dialog, we need to wait for the cooldown
    // to expire, or otherwise the dialog won't be dismissed when attempting
    // to show it again next
    await waitForIpmCooldown();

    await navigateTo(testPageUrl);
    await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });

    await initOptionsGeneralTab(getOptionsHandle());
    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await initOptionsGeneralTab(getOptionsHandle());
    const { counts } = await getPendingLoggerCdpEventStats();

    const ipmId = "test_adblock_exclusion";
    expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
    expect(counts).not.toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
  });

  it("triggers an OPD campaign up to its experiment-configured impression cap and dismissed afterwards", async function () {
    const ipmId = "test_adblock_navigation";
    const maxImpressions = 3;

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, ipmId);
    // `mods: [0, 1000]` covers the full assignment range, so this variant -
    // and the flag it carries - is always active regardless of the user's
    // randomly assigned experiment seed.
    await setRemoteConfigExperiments(initOptionsGeneralTab, [
      {
        experimentId: "opd_persistence_experiment_test",
        variants: [
          {
            variantId: "enabled",
            mods: [0, 1000],
            flags: {
              "crumbs-opd-config": { [ipmId]: { maxImpressions, ignoreCooldown: true } },
            },
          },
        ],
      },
    ]);
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);

    // Every qualifying page load spends an impression, whether it's a reload
    // of the same page or a navigation to a different one, so alternate
    // between two qualifying domains in the same tab. This is what exercises
    // the stale dialog assignment cleanup in handlePageLoadedEvent, which only
    // a same-tab navigation - not a fresh tab - can trigger.
    const qualifyingUrls = [localTestPageUrl, testPageUrl];

    try {
      await openNewTab(qualifyingUrls[0]);
      await getOPDShadowRoot();

      for (let shown = 1; shown < maxImpressions; shown += 1) {
        await navigateTo(qualifyingUrls[shown % qualifyingUrls.length]);
        await getOPDShadowRoot();
      }

      // Cap reached: the next qualifying page load shows nothing.
      await navigateTo(qualifyingUrls[maxImpressions % qualifyingUrls.length]);
      await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });
    } finally {
      await setRemoteConfigExperiments(initOptionsGeneralTab, []);
    }
  });

  it("triggers an OPD campaign cookie", async function () {
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_cookie");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cookie);

    await openNewTab(localTestPageUrl);
    await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });

    await openNewTab(cookieBannerTestPageUrl);
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

  it("does not trigger an OPD campaign if opted out of marketing messages", async function () {
    await setMarketingOptOutState(true);

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_navigation");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);
    await openNewTab(localTestPageUrl);

    await waitForNeverDisplayed("#__ABoverlay", { checkDisplayed: false });
  });

  it("triggers an OPD campaign using strings matching user locale", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-AT");

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_translations");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);

    await openNewTab(localTestPageUrl);

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de-AT] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[de-AT] CTA translations");
    expect(texts[0]).toEqual("[de-AT] This is a test translations OPD");
    expect(texts[1]).toEqual("[de-AT] ipmID: test_adblock_translations");

    // Showing this dialog started the global, cross-campaign cooldown; wait
    // it out so the next test isn't silently blocked by it.
    await waitForIpmCooldown();
  });

  it("triggers an OPD campaign using strings matching user language", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-DE");

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_translations");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);

    await openNewTab(localTestPageUrl);

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[de] CTA translations");
    expect(texts[0]).toEqual("[de] This is a test translations OPD");
    expect(texts[1]).toEqual("[de] ipmID: test_adblock_translations");

    // Showing this dialog started the global, cross-campaign cooldown; wait
    // it out so the next test isn't silently blocked by it.
    await waitForIpmCooldown();
  });

  it("triggers an OPD campaign using strings matching default locale", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "pt-BR");

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_translations");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);

    await openNewTab(localTestPageUrl);

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[en] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[en] CTA translations");
    expect(texts[0]).toEqual("[en] This is a test translations OPD");
    expect(texts[1]).toEqual("[en] ipmID: test_adblock_translations");
  });
};
