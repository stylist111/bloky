/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

import { expect } from "expect";

import { openNewTab, wait } from "@eyeo/test-utils/driver";
import { blockHideUrl } from "@eyeo/test-utils/host-urls";
import { beforeEachTasks } from "@eyeo/test-utils/hooks";
import { allowlistingFilter } from "@eyeo/test-utils/host-filters";
import {
  removeFilterProgrammatically,
  setTimeoutForExtensionReload,
  reloadExtension
} from "@eyeo/test-utils/extension";
import {
  sendExtCommand,
  updateExtPrefAPIKey
} from "@eyeo/test-utils/public-api";
import { checkBlockHidePage, initOptionsGeneralTab } from "../../utils/page.js";

const allowlistingCommand = {
  triggerEventName: "domain_allowlisting_request",
  responseEventName: "domain_allowlisting_success"
};

async function allowlistPageAndCheck(command) {
  await openNewTab(blockHideUrl);

  const allowlistingSuccess = await sendExtCommand(command);
  expect({ allowlistingSuccess }).toEqual({ allowlistingSuccess: true });

  // Even though there's allowlistingSuccess confirmation, sometimes the filter
  // may take a while to be effective on the page (seen in Firefox)
  await wait(
    async () => {
      await driver.navigate().refresh();
      try {
        await checkBlockHidePage(true);
        return true;
      } catch (e) {}
    },
    3000,
    "Blockhide page was not allowlisted"
  );
}

export default () => {
  before(async function () {
    setTimeoutForExtensionReload(this);
    // beforeEach hook in index.js executes after this before hook.
    // Calling beforeEachTasks ensures the options page is opened and focused before updating preferences
    await beforeEachTasks();

    await updateExtPrefAPIKey(
      initOptionsGeneralTab,
      "allowlisting_authorizedKeys"
    );
    // Suppress the opening of the update page when the extension is reloaded
    await reloadExtension(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await removeFilterProgrammatically(
      initOptionsGeneralTab,
      allowlistingFilter
    );
  });

  it("allowlists the page forever", async function () {
    // allowlisting without expiration
    await allowlistPageAndCheck(allowlistingCommand);
  });

  it("allowlists the page with expiration", async function () {
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
    const commandWithExpiration = {
      ...allowlistingCommand,
      options: { expiresAt }
    };

    // allowlisting with expiration
    await allowlistPageAndCheck(commandWithExpiration);
  });
};
