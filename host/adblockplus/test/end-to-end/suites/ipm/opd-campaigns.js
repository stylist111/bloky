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
  setRemoteConfigExperiments,
  setRemoteConfigIpmCommands,
  setRemoteConfigUrl,
  clearDismissedIpmIds,
  getIPMCommands,
  setIPMCooldowns,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats,
  waitForIpmCooldown,
  overrideLanguageForIpmContent
} from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  waitForNeverDisplayed,
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
import {
  initOptionsGeneralTab,
  setMarketingOptOutState
} from "../../utils/page.js";

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

export default () => {
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
  });

  beforeEach(async function () {
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await clearDismissedIpmIds(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await overrideLanguageForIpmContent(null);
    await setMarketingOptOutState(false);
    await clearRemoteConfigIpmCommands(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
  });

  it("triggers an OPD campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_navigation"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);
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
    await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
      checkDisplayed: false
    });

    await initOptionsGeneralTab(getOptionsHandle());
    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await initOptionsGeneralTab(getOptionsHandle());
    const { counts } = await getPendingLoggerCdpEventStats();

    const ipmId = "test_adblockplus_navigation";
    expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`, 1);
    expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
  });

  it("triggers an OPD campaign exclusion and dismissed after page reload", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_exclusion"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.exclusion);

    await openNewTab("https://www.example.org");
    await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
      checkDisplayed: false
    });

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

    // After successfully showing the dialog, we need to wait for the cooldown
    // to expire, or otherwise the dialog won't be dismissed when attempting
    // to show it again next
    await waitForIpmCooldown();

    await driver.navigate().refresh();
    await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
      checkDisplayed: false
    });

    await initOptionsGeneralTab(getOptionsHandle());

    await initOptionsGeneralTab(getOptionsHandle());
    const { counts } = await getPendingLoggerCdpEventStats();

    const ipmId = "test_adblockplus_exclusion";
    expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdCommandReadyEvent}:${ipmId}`, 1);
    expect(counts).toHaveProperty(`${opdDialogInjectedEvent}:${ipmId}`, 1);
    expect(counts).not.toHaveProperty(`${opdDialogClickedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogClosedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${opdDialogIgnoredEvent}:${ipmId}`);
  });

  it("triggers an OPD campaign up to its experiment-configured impression cap and dismissed afterwards", async function () {
    // TODO(OM-1641): unskip once fixed - flaky in CI (a duplicate "loaded"
    // event for the same tab can get the campaign's dialog permanently
    // dropped from `unassignedDialogs` via `showDialogFromList`'s dismissal
    // path).
    if (process.env.CI === "true") {
      this.skip();
    }

    const ipmId = "test_adblockplus_navigation";
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
              "crumbs-opd-config": {
                [ipmId]: { maxImpressions, ignoreCooldown: true }
              }
            }
          }
        ]
      }
    ]);
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);

    try {
      // Every qualifying page load spends an impression, so a fresh tab per
      // impression is enough to exercise the cap.
      //
      // TODO(OM-1641): a same-tab navigation to a different qualifying domain
      // is what actually exercises the stale dialog assignment cleanup in
      // handlePageLoadedEvent, and is what originally found the
      // TabSessionStorage race OM-1641 fixes. Reusing the same tab (via
      // reload or navigation) re-triggers that race on every impression,
      // since assignedDialogs' read in handlePageLoadedEvent isn't queued
      // against the tab session's own writes - flaky until that fix lands.
      // A fresh tab has no prior assignment to race against, so this uses one
      // per impression in the meantime. Switch back to same-tab navigation
      // once OM-1641 merges.
      for (let shown = 0; shown < maxImpressions; shown += 1) {
        await openNewTab("https://www.example.com");
        await switchToOPDiframe();
        await driver.switchTo().defaultContent();
      }

      // Cap reached: a fresh qualifying tab shows nothing.
      await openNewTab("https://www.example.com");
      await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
        checkDisplayed: false
      });
    } finally {
      await setRemoteConfigExperiments(initOptionsGeneralTab, []);
    }
  });

  it("triggers an OPD campaign cookie", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_cookie"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cookie);

    await openNewTab("https://www.example.org");
    await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
      checkDisplayed: false
    });

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

  it("does not trigger an OPD campaign if opted out of marketing messages", async function () {
    await setMarketingOptOutState(true);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_navigation"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation);
    await openNewTab("https://www.example.com");

    await waitForNeverDisplayed("#__abp-overlay-onpage-dialog iframe", {
      checkDisplayed: false
    });
  });

  it("triggers an OPD campaign using strings matching user locale", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-AT");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_translations"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);
    await openNewTab("https://www.example.com");

    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de-AT] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[DE-AT] CTA TRANSLATIONS");
    expect(texts[0]).toEqual("[de-AT] This is a test translations OPD");
    expect(texts[1]).toEqual("[de-AT] ipmID: test_adblockplus_translations");

    // Showing this dialog started the global, cross-campaign cooldown; wait
    // it out so the next test isn't silently blocked by it.
    await waitForIpmCooldown();
  });

  it("triggers an OPD campaign using strings matching user language", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-DE");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_translations"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);
    await openNewTab("https://www.example.com");

    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[DE] CTA TRANSLATIONS");
    expect(texts[0]).toEqual("[de] This is a test translations OPD");
    expect(texts[1]).toEqual("[de] ipmID: test_adblockplus_translations");

    // Showing this dialog started the global, cross-campaign cooldown; wait
    // it out so the next test isn't silently blocked by it.
    await waitForIpmCooldown();
  });

  it("triggers an OPD campaign using strings matching default locale", async function () {
    await overrideLanguageForIpmContent(initOptionsGeneralTab, "pt-BR");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_translations"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations);
    await openNewTab("https://www.example.com");

    await switchToOPDiframe();
    const opdTitle = await getDisplayedElement("#title");
    const ctaButton = await getDisplayedElement("#continue");
    const paragraphs = await driver.findElements(By.css("#body p"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[en] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[EN] CTA TRANSLATIONS");
    expect(texts[0]).toEqual("[en] This is a test translations OPD");
    expect(texts[1]).toEqual("[en] ipmID: test_adblockplus_translations");
  });
};
