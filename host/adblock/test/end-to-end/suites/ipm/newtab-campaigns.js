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

/* eslint-disable camelcase */

import { expect } from "expect";
import {
  getOptionsHandle,
  setTimeoutForExtensionReload,
  reloadExtension,
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
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import { expectedIPMCommands } from "../../utils/ipms.js";
import {
  updateUrlNewTab,
  updateUrlForce,
  updateUrlPriorityHigh,
  updateUrlPriorityLow,
} from "../../utils/urls.js";
import {
  initOptionsGeneralTab,
  isPremiumLabelPresent,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
} from "../../utils/page.js";

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
    setTimeoutForExtensionReload(this);
    await initOptionsGeneralTab(getOptionsHandle());
    await disablePremiumProgrammatically();
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
    await resetIPMFragment(getOptionsHandle);
  });

  it("triggers a new tab campaign", async function () {
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_newtab");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.newtab[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlNewTab);
    await initOptionsGeneralTab(getOptionsHandle());

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
      const actions = pingPayload.events.map((e) => e.action);
      expect(actions).toEqual(["received", "tab_created", "has_content:1", "tab_loaded"]);
    }
  });

  it("triggers new tab campaigns by priority", async function () {
    setTimeoutForExtensionReload(this);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_priority");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.priority[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh);
    await findUrl(updateUrlPriorityLow, { exists: false });

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.lowPriority[fragmentType]);

    // Ping payloads only exist in future fragment
    if (fragmentType === "legacy") {
      const pingPayload = await syncRemoteConfig(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);
      expect(pingPayload.ipm.active).toEqual([{ id: "test_adblock_priority_low" }]);
      expect(actions).toEqual([
        "received",
        "received",
        "tab_created",
        "has_content:1",
        "tab_loaded",
      ]);
    }

    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
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
    await enablePremiumProgrammatically(15000);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_premium");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
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
        "received",
        "error_no_behavior",
        "license_state_no_match",
        "error_no_behavior",
      ]);
    }
  });

  it("force triggers a new tab campaign", async function () {
    const premiumAlreadyEnabled = await isPremiumLabelPresent();
    if (!premiumAlreadyEnabled) {
      await enablePremiumProgrammatically();
    }
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_force");
    await syncRemoteConfig(initOptionsGeneralTab);
    await findUrl(updateUrlForce);
  });
};
