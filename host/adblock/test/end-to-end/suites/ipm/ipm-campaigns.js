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
  updateSettings,
  setRemoteConfigUrl,
  syncRemoteConfig,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment,
  clearDismissedIpmIds,
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import { updateUrlVersions } from "../../utils/urls.js";
import { initOptionsGeneralTab } from "../../utils/page.js";
import { expectedIPMCommands } from "../../utils/ipms.js";

export default (fragmentType) => {
  before(async function () {
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

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
    await resetIPMFragment(getOptionsHandle);
  });

  it("checks IPM versions and ping alarm", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // Pings only exist in the legacy fragment
    if (fragmentType === "future") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    const payload = await syncRemoteConfig(initOptionsGeneralTab);
    const { capabilities } = payload.ipm;
    let { pingAlarm } = await driver.executeAsyncScript(async (callback) => {
      pingAlarm = await browser.alarms.get("pingalarm");
      callback({ pingAlarm });
    });

    expect(pingAlarm.scheduledTime).toBeGreaterThan(Date.now());
    expect(capabilities).toEqual([
      { name: "multi_ipm_response", version: 1 },
      { name: "create_on_page_dialog", version: 7 },
      { name: "create_tab", version: 6 },
      { name: "delete_commands", version: 2 },
    ]);
  });

  it("deletes an active campaign (using delete_commands command)", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // The delete_commands command is not needed in the future fragment
    if (fragmentType === "future") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual(expectedIPMCommands.versions[fragmentType]);

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_delete");
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("deletes an active campaign (if no longer present in remote config)", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // This behavior only exists in the future fragment
    if (fragmentType === "legacy") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual(expectedIPMCommands.versions[fragmentType]);

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_none");
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("checks IPM errors", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_uknown_command");
    await syncRemoteConfig(initOptionsGeneralTab);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_invalid_command");
    await syncRemoteConfig(initOptionsGeneralTab);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_missing_params");
    await syncRemoteConfig(initOptionsGeneralTab);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_wrong_version");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not trigger a campaign on Firefox", async function () {
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });
};
