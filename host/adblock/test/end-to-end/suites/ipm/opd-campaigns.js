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
  setRemoteConfigCohorts,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment,
  clearDismissedIpmIds,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats,
  waitForIpmCooldown,
  overrideLanguageForIpmContent,
  setTimeoutForExtensionReload,
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
import {
  initOptionsGeneralTab,
  setMarketingOptOutState,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
} from "../../utils/page.js";

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
    await setMarketingOptOutState(false);
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

      expect(actions).toEqual(["received", "dialog_injected", "dialog_button_clicked"]);
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

    // After successfully showing the dialog, we need to wait for the cooldown
    // to expire, or otherwise the dialog won't be dismissed when attempting
    // to show it again next
    await waitForIpmCooldown();

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

      expect(actions).toEqual(["received", "dialog_injected", "dialog_injected"]);
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

  it("does not trigger an OPD campaign if opted out of marketing messages", async function () {
    await setMarketingOptOutState(true);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblock_navigation_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.navigation[fragmentType]);
    await openNewTab("https://www.example.com");

    await waitForNotDisplayed("#__ABoverlay");
  });

  it("triggers an OPD campaign using strings matching user locale", async function () {
    // Legacy fragment doesn't support translations
    if (fragmentType === "legacy") {
      this.skip();
    }

    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-AT");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblock_translations_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations[fragmentType]);

    await openNewTab("https://www.example.com");

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de-AT] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[de-AT] CTA translations");
    expect(texts[0]).toEqual("[de-AT] This is a test translations OPD");
    expect(texts[1]).toEqual("[de-AT] ipmID: test_adblock_translations");
  });

  it("triggers an OPD campaign using strings matching user language", async function () {
    // Legacy fragment doesn't support translations
    if (fragmentType === "legacy") {
      this.skip();
    }

    await overrideLanguageForIpmContent(initOptionsGeneralTab, "de-DE");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblock_translations_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations[fragmentType]);

    await openNewTab("https://www.example.com");

    const opd = await getOPDShadowRoot();
    const opdTitle = await opd.findElement(By.css("#titleRow"));
    const ctaButton = await opd.findElement(By.css("#continue"));
    const paragraphs = await opd.findElements(By.css(".msgText"));
    const texts = await Promise.all(paragraphs.map((p) => p.getText()));

    expect(await opdTitle.getText()).toEqual("[de] OPD translations title");
    expect(await ctaButton.getText()).toEqual("[de] CTA translations");
    expect(texts[0]).toEqual("[de] This is a test translations OPD");
    expect(texts[1]).toEqual("[de] ipmID: test_adblock_translations");
  });

  it("triggers an OPD campaign using strings matching default locale", async function () {
    // Legacy fragment doesn't support translations
    if (fragmentType === "legacy") {
      this.skip();
    }

    await overrideLanguageForIpmContent(initOptionsGeneralTab, "pt-BR");

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      `test_adblock_translations_${fragmentType}`,
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.translations[fragmentType]);

    await openNewTab("https://www.example.com");

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

  describe("OPD campaign with trial cohort", function () {
    before(async function () {
      // Cohorts are only supported in the future fragment
      if (fragmentType === "legacy") {
        this.skip();
      }
      await setRemoteConfigCohorts(initOptionsGeneralTab, [
        {
          name: "Trial users without marketing consent",
          conditions: {
            all: [
              {
                fact: "isTrial",
                operator: "equal",
                value: true,
              },
              {
                fact: "marketingConsent",
                operator: "equal",
                value: false,
              },
            ],
          },
          event: {
            type: "test-trial-users",
          },
        },
      ]);
    });

    beforeEach(async function () {
      await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_trial_cohort");
      await syncRemoteConfig(initOptionsGeneralTab);
      const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
      expect(ipmCommands).toEqual(expectedIPMCommands.trialCohort[fragmentType]);
    });

    after(async function () {
      setTimeoutForExtensionReload(this);
      await disablePremiumProgrammatically();
    });

    it("does not trigger an OPD campaign when trial cohort does not match", async function () {
      // Since isTrial is false and trialDaysLeft is null by default, OPD should NOT trigger
      await openNewTab("https://www.example.com");
      await waitForNotDisplayed("#__ABoverlay");
    });

    it("triggers an OPD campaign when trial cohort matches", async function () {
      await enablePremiumProgrammatically({ isTrial: true });
      await syncRemoteConfig(initOptionsGeneralTab);
      await openNewTab("https://www.example.com");

      const opd = await getOPDShadowRoot();
      const opdTitle = await opd.findElement(By.css("#titleRow"));
      const ctaButton = await opd.findElement(By.css("#continue"));
      const paragraphs = await opd.findElements(By.css(".msgText"));
      const texts = await Promise.all(paragraphs.map((p) => p.getText()));

      expect(await opdTitle.getText()).toEqual("Trial OPD title");
      expect(await ctaButton.getText()).toEqual("CTA trial");
      expect(texts[0]).toEqual("This is a test OPD for trial users");
      expect(texts[1]).toEqual("ipmID: test_adblock_trial_cohort");
    });
  });
};
