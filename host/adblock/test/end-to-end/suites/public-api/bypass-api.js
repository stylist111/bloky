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

import { openNewTab } from "@eyeo/test-utils/driver";
import { blockHideUrl } from "@eyeo/test-utils/urls";
import { beforeEachTasks } from "@eyeo/test-utils/hooks";
import { allowlistingFilter } from "@eyeo/test-utils/filters";
import {
  addFiltersProgrammatically,
  removeFilterProgrammatically,
  setTimeoutForExtensionReload,
  reloadExtension,
} from "@eyeo/test-utils/extension";
import { sendExtCommand, updateExtPrefAPIKey } from "@eyeo/test-utils/public-api";

import { checkBlockHidePage, initOptionsGeneralTab } from "../../utils/page.js";

export default () => {
  before(async function () {
    setTimeoutForExtensionReload(this);
    // beforeEach hook in index.js executes after this before hook. Calling beforeEachTasks ensures the options page is opened and focused before updating preferences
    await beforeEachTasks();

    await updateExtPrefAPIKey(initOptionsGeneralTab, "bypass_authorizedKeys");
    await reloadExtension(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await removeFilterProgrammatically(initOptionsGeneralTab, allowlistingFilter);
  });

  it("returns adblocking is active extension info", async function () {
    await openNewTab(blockHideUrl);

    // send request extension info command
    const { extensionInfo } = await sendExtCommand({
      triggerEventName: "flattr-request-payload",
      responseEventName: "flattr-payload",
    });

    const expectedExtensionInfo = {
      name: extension.flattrName,
      version: extension.version,
      allowlistState: {
        oneCA: true,
        source: null,
        status: false,
      },
    };

    expect(extensionInfo).toEqual(expectedExtensionInfo);
  });

  it("returns allowlisted page extension info", async function () {
    await openNewTab(blockHideUrl);
    await checkBlockHidePage(false);
    await addFiltersProgrammatically(initOptionsGeneralTab, allowlistingFilter);

    await checkBlockHidePage(true);

    // send request extension info command
    const { extensionInfo } = await sendExtCommand({
      triggerEventName: "flattr-request-payload",
      responseEventName: "flattr-payload",
    });

    const expectedExtensionInfo = {
      name: extension.flattrName,
      version: extension.version,
      allowlistState: {
        oneCA: true,
        source: "user",
        status: true,
      },
    };

    expect(extensionInfo).toEqual(expectedExtensionInfo);
  });
};
