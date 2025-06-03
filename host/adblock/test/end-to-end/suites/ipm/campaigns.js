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
  reloadExtension,
  setUserId,
  setIPMServer,
  pingIPMServer,
  getIPMCommands,
} from "@eyeo/test-utils/extension";
import { expect } from "expect";
import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/urls";
import { updateUrl } from "../../utils/urls.js";
import {
  getUserIdFromInstallPage,
  initOptionsGeneralTab,
  getUserIdFromStorage,
} from "../../utils/page.js";

export default () => {
  after(async function () {
    // we should reset the user ID back to it's original state as it is used in subsequent tests
    const originalUserId = await getUserIdFromInstallPage();
    await initOptionsGeneralTab(getOptionsHandle());
    await setUserId(getOptionsHandle, originalUserId);
    await reloadExtension(initOptionsGeneralTab);

    const currentUserId = await getUserIdFromStorage(getOptionsHandle());
    expect(currentUserId).toEqual(originalUserId);
  });

  it("triggers a new tab campaign", async function () {
    this.timeout(60000); // Long test with many checks, including the extension reload

    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await initOptionsGeneralTab(getOptionsHandle());
    await setUserId(getOptionsHandle, "newtabtriggerAB");
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });
    await setIPMServer(initOptionsGeneralTab);
    await pingIPMServer(initOptionsGeneralTab);
    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);

    let { pingAlarm } = await driver.executeAsyncScript(async (callback) => {
      try {
        pingAlarm = await browser.alarms.get("pingalarm");
        callback({ pingAlarm });
      } catch (err) {
        callback({ err });
      }
    });

    const expectedIPMCommand = {
      newtabtriggerAB_1: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number),
        },
        command_name: "create_tab",
        device_id: "newtabtriggerAB",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        ipm_id: "newtabtriggerAB_1",
        method: "default",
        url: "/update",
        version: 6,
      },
    };

    expect(ipmCommands).toEqual(expectedIPMCommand);
    expect(pingAlarm.scheduledTime).toBeGreaterThan(Date.now());

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrl);
    await initOptionsGeneralTab(getOptionsHandle());
    const pingPayload = await pingIPMServer(initOptionsGeneralTab);

    expect(pingPayload.ipm.active).toEqual([]);
    const actions = pingPayload.events.map((e) => e.action);
    expect(actions).toEqual(["received", "tab_created", "tab_loaded"]);
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

    await initOptionsGeneralTab(getOptionsHandle());
    await setUserId(getOptionsHandle, "multiplecommandsAB");
    await reloadExtension(initOptionsGeneralTab);
    await setIPMServer(initOptionsGeneralTab);
    await pingIPMServer(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);

    // ipmCommands should be an empty object
    expect(ipmCommands).toEqual({});
  });
};
