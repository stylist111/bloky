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

import {
  getOptionsHandle,
  setTimeoutForExtensionReload,
  reloadExtension,
  updateSettings,
  setIPMServer,
  pingIPMServer,
  setIPMServerResponse,
  getIPMCommands,
  setIPMCooldowns,
  getSelectedFragmentType,
  resetIPMFragment,
  setIPMFragment,
} from "@eyeo/test-utils/extension";
import { expect } from "expect";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/urls";
import {
  expectedIPMCommandsNewtab,
  expectedIPMCommandsPriority,
  expectedIPMCommandsLowPriority,
  expectedIPMCommandsPremium,
} from "../../utils/ipms.js";
import { updateUrl, updateUrlPriorityHigh, updateUrlPriorityLow } from "../../utils/urls.js";
import {
  initOptionsGeneralTab,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
} from "../../utils/page.js";

export default () => {
  /* ########################################## */
  /* ############ Fragment: Legacy ############ */
  /* ########################################## */

  const fragmentType = "legacy";
  describe(`Selected fragment: ${fragmentType}`, () => {
    before(async function () {
      await setIPMServer(initOptionsGeneralTab);
      await setIPMCooldowns(initOptionsGeneralTab);

      // `suppress_update_page` must be set to false before running tests,
      // so that newtabs can be triggered. This setting is otherwise set to true
      // to prevent real newtab IPMs from opening and interfering with the tests.
      await updateSettings(initOptionsGeneralTab, "suppress_update_page", false);
      await setIPMFragment(getOptionsHandle, fragmentType);
      const selectedFragmentType = await getSelectedFragmentType(getOptionsHandle);
      expect(selectedFragmentType).toEqual(fragmentType);
    });

    afterEach(async function () {
      await setIPMServerResponse("test_adblock_delete");
      await pingIPMServer(initOptionsGeneralTab);
      const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual({});
    });

    after(async function () {
      setTimeoutForExtensionReload(this);
      await disablePremiumProgrammatically();
      await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
      await resetIPMFragment(getOptionsHandle);
    });

    it("triggers a new tab campaign and checks ping alarm", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }
      await setIPMServerResponse("test_adblock_newtab");
      await pingIPMServer(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      let { pingAlarm } = await driver.executeAsyncScript(async (callback) => {
        pingAlarm = await browser.alarms.get("pingalarm");
        callback({ pingAlarm });
      });

      expect(ipmCommands).toEqual(expectedIPMCommandsNewtab);
      expect(pingAlarm.scheduledTime).toBeGreaterThan(Date.now());

      await openNewTab(localTestPageUrl);
      await findUrl(updateUrl);
      await initOptionsGeneralTab(getOptionsHandle());

      const pingPayload = await pingIPMServer(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
      const actions = pingPayload.events.map((e) => e.action);
      expect(actions).toEqual(["received", "tab_created", "tab_loaded"]);
    });

    it("triggers new tab campaigns by priority", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }
      setTimeoutForExtensionReload(this);
      await setIPMServerResponse("test_adblock_priority");
      await pingIPMServer(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual(expectedIPMCommandsPriority);

      await openNewTab(localTestPageUrl);
      await findUrl(updateUrlPriorityHigh);
      await findUrl(updateUrlPriorityLow, { exists: false });

      const ipmCommand = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      let pingPayload = await pingIPMServer(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);

      expect(ipmCommand).toEqual(expectedIPMCommandsLowPriority);
      expect(pingPayload.ipm.active).toEqual([{ id: "test_adblock_newtab_priority_low" }]);
      expect(actions).toEqual([
        "received",
        "received",
        "tab_created",
        "has_content:1",
        "tab_loaded",
      ]);

      await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
      await openNewTab(localTestPageUrl);
      await findUrl(updateUrlPriorityLow);

      pingPayload = await pingIPMServer(initOptionsGeneralTab);
      expect(pingPayload.ipm.active).toEqual([]);
    });

    it("deletes a new tab campaign", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }
      await setIPMServerResponse("test_adblock_newtab");
      await pingIPMServer(initOptionsGeneralTab);

      let ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual(expectedIPMCommandsNewtab);

      await setIPMServerResponse("test_adblock_delete");
      await pingIPMServer(initOptionsGeneralTab);

      ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual({});

      await openNewTab(localTestPageUrl);
      await findUrl(updateUrl, { exists: false });
    });

    it("does not trigger a new tab campaign for premium user", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }

      await enablePremiumProgrammatically(15000); // wait up to 15s for Premium activation
      await setIPMServerResponse("test_adblock_premium");
      await pingIPMServer(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual(expectedIPMCommandsPremium);

      await openNewTab(localTestPageUrl);
      await findUrl(updateUrl, { exists: false });

      const pingPayload = await pingIPMServer(initOptionsGeneralTab);
      const actions = pingPayload.events.map((e) => e.action);

      expect(actions).toEqual([
        "received",
        "error_no_behavior",
        "error_no_behavior",
        "license_state_no_match",
        "error_no_behavior",
      ]);
    });

    it("checks IPM versions", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }
      await setIPMServerResponse("test_adblock_newtab");
      const payload = await pingIPMServer(initOptionsGeneralTab);
      const { capabilities } = payload.ipm;

      expect(capabilities).toEqual([
        { name: "multi_ipm_response", version: 1 },
        { name: "create_on_page_dialog", version: 7 },
        { name: "create_tab", version: 6 },
        { name: "delete_commands", version: 2 },
      ]);
    });

    it("does not trigger campaigns on Firefox", async function () {
      if (browserDetails.browserName !== "firefox") {
        this.skip();
      }
      await setIPMServerResponse("test_adblock_newtab");
      const ipmCommands = await getIPMCommands(initOptionsGeneralTab, fragmentType);
      expect(ipmCommands).toEqual({});

      await openNewTab(localTestPageUrl);
      await findUrl(updateUrl, { exists: false });
    });
  });

  /* ########################################## */
  /* ############ Fragment: Future ############ */
  /* ########################################## */

  // No e2e tests yet.
};
