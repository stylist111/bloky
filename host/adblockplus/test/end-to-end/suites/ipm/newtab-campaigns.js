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
import {
  getOptionsHandle,
  setTimeoutForExtensionReload,
  reloadExtension,
  updatePrefs,
  setRemoteConfigCohorts,
  setRemoteConfigIpmCommands,
  setRemoteConfigUrl,
  clearDismissedIpmIds,
  syncRemoteConfig,
  getIPMCommands,
  setIPMCooldowns,
  clearRemoteConfigIpmCommands,
  getPendingLoggerCdpEventStats
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab, waitForAssertion } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import { expectedIPMCommands } from "../../utils/ipms.js";
import {
  updateUrlNewTab,
  updateUrlPremium,
  updateUrlForce,
  updateUrlPriorityHigh,
  updateUrlPriorityLow
} from "../../utils/urls.js";
import {
  commandReceivedEvent,
  tabCommandReadyEvent,
  tabCreatedEvent,
  tabLoadedEvent
} from "../../utils/events.js";
import {
  initOptionsGeneralTab,
  isPremiumActivated,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
  setMarketingOptOutState
} from "../../utils/page.js";

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
    await setMarketingOptOutState(false);
    await clearRemoteConfigIpmCommands(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    await initOptionsGeneralTab(getOptionsHandle());
    await disablePremiumProgrammatically();
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
  });

  it("triggers a new tab campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_newtab"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.newtab);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlNewTab, { mustLoad: true });

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblockplus_newtab";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmId}`, 1);
    }, 5000);
  });

  it("triggers a new tab campaigns by priority", async function () {
    setTimeoutForExtensionReload(this, 90000);
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_priority"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmIdLow = "test_adblockplus_priority_low";
    const ipmIdHigh = "test_adblockplus_priority_high";

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.priority);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh, { mustLoad: true });
    await findUrl(updateUrlPriorityLow, { exists: false, timeout: 2000 });

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.lowPriority);

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdLow}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmIdLow}`, 1);
      expect(counts).not.toHaveProperty(`${tabCreatedEvent}:${ipmIdLow}`);
      expect(counts).not.toHaveProperty(`${tabLoadedEvent}:${ipmIdLow}`);

      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmIdHigh}`, 1);
    }, 5000);

    await reloadExtension(initOptionsGeneralTab, {
      suppressUpdatePage: false
    });
    await setRemoteConfigUrl(initOptionsGeneralTab);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityLow, { mustLoad: true });

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdLow}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmIdLow}`, 2);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmIdLow}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmIdLow}`, 1);

      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmIdHigh}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmIdHigh}`, 1);
    }, 5000);
  });

  it("does not trigger a new tab campaign if opted out of marketing messages", async function () {
    await setMarketingOptOutState(true);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_newtab"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlNewTab, { exists: false });
  });

  it("does not trigger a new tab campaign for premium user", async function () {
    this.timeout(60000);
    const isPremium = await isPremiumActivated();

    if (!isPremium) {
      await enablePremiumProgrammatically();
    }

    await setRemoteConfigCohorts(initOptionsGeneralTab, [
      {
        name: "Test Free Users",
        conditions: {
          all: [
            {
              fact: "hasPremium",
              operator: "equal",
              value: false
            }
          ]
        },
        event: {
          type: "test-free-users"
        }
      }
    ]);
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_premium"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.premium);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPremium, { exists: false });

    await initOptionsGeneralTab(getOptionsHandle());
    const { counts } = await getPendingLoggerCdpEventStats();

    const ipmId = "test_adblockplus_premium";
    expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
    expect(counts).not.toHaveProperty(`${tabCommandReadyEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${tabCreatedEvent}:${ipmId}`);
    expect(counts).not.toHaveProperty(`${tabLoadedEvent}:${ipmId}`);
  });

  it("force triggers a new tab campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_force"
    );
    await syncRemoteConfig(initOptionsGeneralTab);
    await findUrl(updateUrlForce, { mustLoad: true });

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmId = "test_adblockplus_force";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmId}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmId}`, 1);
    });
  });
};
