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
  setUserId,
  setIPMServer,
  pingIPMServer,
  getIPMCommands,
  setIPMCooldowns,
} from "@eyeo/test-utils/extension";
import { expect } from "expect";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { cleanupOpenTabs } from "@eyeo/test-utils/hooks";
import { localTestPageUrl } from "@eyeo/test-utils/urls";
import { updateUrl, updateUrlPriorityHigh, updateUrlPriorityLow } from "../../utils/urls.js";
import {
  getUserIdFromInstallPage,
  initOptionsGeneralTab,
  getUserIdFromStorage,
  enablePremiumProgrammatically,
  disablePremiumProgrammatically,
} from "../../utils/page.js";

const expectedIPMCommands = {
  test_adblock_newtab_priority_low: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_low",
    device_id: "test_adblock_newtab",
    command_name: "create_tab",
    method: "default",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_low",
    version: 6,
  },
  test_adblock_newtab_priority_high: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_high",
    device_id: "test_adblock_newtab",
    command_name: "create_tab",
    method: "default",
    license_state_list: "free",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_high",
    priority: 3,
    version: 6,
  },
};

const expectedIPMCommandLowPriority = {
  test_adblock_newtab_priority_low: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_low",
    device_id: "test_adblock_newtab",
    command_name: "create_tab",
    method: "default",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_low",
    version: 6,
  },
};

const expectedIPMCommandPremium = {
  test_adblock_newtab_premium: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_premium",
    device_id: "test_adblock_premium",
    command_name: "create_tab",
    method: "default",
    license_state_list: "free",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update",
    version: 6,
  },
};

export default () => {
  before(async function () {
    setTimeoutForExtensionReload(this);
    await setIPMServer(initOptionsGeneralTab);
    await setIPMCooldowns(initOptionsGeneralTab);
    await setUserId(getOptionsHandle, "test_adblock_newtab");
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
    const currentUserId = await getUserIdFromStorage(getOptionsHandle());
    expect(currentUserId).toEqual("test_adblock_newtab");
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    const originalUserId = await getUserIdFromInstallPage();
    await initOptionsGeneralTab(getOptionsHandle());
    await setUserId(getOptionsHandle, originalUserId);
    await disablePremiumProgrammatically();
    const currentUserId = await getUserIdFromStorage(getOptionsHandle());
    expect(currentUserId).toEqual(originalUserId);
  });

  it("triggers a new tab campaign and checks ping alarm", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await pingIPMServer(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);

    let { pingAlarm } = await driver.executeAsyncScript(async (callback) => {
      pingAlarm = await browser.alarms.get("pingalarm");
      callback({ pingAlarm });
    });

    expect(ipmCommands).toEqual(expectedIPMCommands);
    expect(pingAlarm.scheduledTime).toBeGreaterThan(Date.now());

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh);
    await initOptionsGeneralTab(getOptionsHandle());
    const pingPayload = await pingIPMServer(initOptionsGeneralTab);

    expect(pingPayload.ipm.active).toEqual([{ id: "test_adblock_newtab_priority_low" }]);
    const actions = pingPayload.events.map((e) => e.action);
    expect(actions).toEqual(["received", "received", "tab_created", "tab_loaded"]);
  });

  it("triggers new tab campaigns by priority", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }
    setTimeoutForExtensionReload(this);

    await pingIPMServer(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh);
    await findUrl(updateUrlPriorityLow, { exists: false });

    const ipmCommand = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommand).toEqual(expectedIPMCommandLowPriority);

    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityLow);

    const pingPayload = await pingIPMServer(initOptionsGeneralTab);
    expect(pingPayload.ipm.active).toEqual([]);
  });

  it("deletes a new tab campaign", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }
    setTimeoutForExtensionReload(this);

    await pingIPMServer(initOptionsGeneralTab);
    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands);

    await setUserId(getOptionsHandle, "test_adblock_delete");
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
    await cleanupOpenTabs();
    await driver.switchTo().window(getOptionsHandle());

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommandLowPriority);

    await pingIPMServer(initOptionsGeneralTab);
    const currentUserId = await getUserIdFromStorage(getOptionsHandle());
    expect(currentUserId).toEqual("test_adblock_delete");

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});
    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh, { exists: false });
    await findUrl(updateUrlPriorityLow, { exists: false });
  });

  it("does not trigger a new tab campaign for premium user", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }
    setTimeoutForExtensionReload(this);

    await enablePremiumProgrammatically();
    await setUserId(getOptionsHandle, "test_adblock_premium");
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
    await pingIPMServer(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommandPremium);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrl, { exists: false });

    const pingPayload = await pingIPMServer(initOptionsGeneralTab);
    const actions = pingPayload.events.map((e) => e.action);
    expect(actions).toEqual(["received", "license_state_no_match"]);
  });

  it("checks IPM versions", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await initOptionsGeneralTab(getOptionsHandle());
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
    await pingIPMServer(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlPriorityHigh, { exists: false });
    await findUrl(updateUrlPriorityLow, { exists: false });
  });
};
