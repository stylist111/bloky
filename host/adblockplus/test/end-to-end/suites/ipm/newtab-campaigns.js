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
  setRemoteConfigIpmCommands,
  setRemoteConfigUrl,
  clearDismissedIpmIds,
  syncRemoteConfig,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import { expectedIPMCommands } from "../../utils/ipms.js";
import {
  updateUrlNewTab,
  updateUrlForce,
  updateUrlPriorityHigh,
  updateUrlPriorityLow
} from "../../utils/urls.js";
import {
  initOptionsGeneralTab,
  isPremiumLabelPresent,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically
} from "../../utils/page.js";

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
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_delete"
    );
    await syncRemoteConfig(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(
      initOptionsGeneralTab,
      fragmentType
    );
    expect(ipmCommands).toEqual({});
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    await initOptionsGeneralTab(getOptionsHandle());
    await disablePremiumProgrammatically();
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
    await resetIPMFragment(initOptionsGeneralTab);
  });

  it("triggers a new tab campaign", async function () {
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_newtab"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(
      initOptionsGeneralTab,
      fragmentType
    );
    expect(ipmCommands).toEqual(expectedIPMCommands.newtab[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlNewTab);
    await initOptionsGeneralTab(getOptionsHandle());

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
      const actions = pingPayload.events.map((e) => e.action);
      expect(actions).toEqual(["tab_created", "tab_loaded"]);
    }
  });

  it("triggers a new tab campaigns by priority", async function () {
    setTimeoutForExtensionReload(this);
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_priority"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual(expectedIPMCommands.priority[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh);
    await findUrl(updateUrlPriorityLow, { exists: false });

    ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual(expectedIPMCommands.lowPriority[fragmentType]);

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);
      expect(pingPayload.ipm.active).toEqual([
        { id: "test_adblockplus_priority_low" }
      ]);
      expect(actions).toEqual(["tab_created", "tab_loaded"]);
    }

    await reloadExtension(initOptionsGeneralTab, {
      suppressUpdatePage: false
    });
    await setRemoteConfigUrl(initOptionsGeneralTab);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityLow);

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
    }
  });

  it("does not trigger a new tab campaign for premium user", async function () {
    this.timeout(60000);
    await enablePremiumProgrammatically();
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_premium"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(
      initOptionsGeneralTab,
      fragmentType
    );
    expect(ipmCommands).toEqual(expectedIPMCommands.premium[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlNewTab, { exists: false });

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);

      // See: https://eyeo.atlassian.net/browse/IM-217
      // for context on error_no_behavior events
      expect(actions).toEqual([
        "error_no_behavior",
        "license_state_no_match",
        "error_no_behavior"
      ]);
    }
  });

  it("force triggers a new tab campaign", async function () {
    const premiumAlreadyEnabled = await isPremiumLabelPresent();
    if (!premiumAlreadyEnabled) {
      await enablePremiumProgrammatically();
    }
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_force"
    );
    await syncRemoteConfig(initOptionsGeneralTab);
    await findUrl(updateUrlForce);
  });
};
