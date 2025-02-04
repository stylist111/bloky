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
  removeFilterProgrammatically,
  reloadExtension,
  sendExtMessage,
} from "@eyeo/test-utils/extension";
import { sendExtCommand, updateExtPrefAPIKey } from "@eyeo/test-utils/public-api";
import { checkBlockHidePage, initOptionsGeneralTab } from "../../utils/page.js";

const allowlistingCommand = {
  triggerEventName: "domain_allowlisting_request",
  responseEventName: "domain_allowlisting_success",
};

async function allowlistPageAndCheck(command) {
  await openNewTab(blockHideUrl);

  // trigger allowlisting without expiration
  const allowlistingSuccess = await sendExtCommand(command);
  expect({ allowlistingSuccess }).toEqual({ allowlistingSuccess: true });

  await driver.navigate().refresh();
  await checkBlockHidePage(true);
}

function validateFilterMetadata(debugInfo, expiresAt = null) {
  expect(debugInfo).not.toBeNull();
  expect(debugInfo.otherInfo).not.toBeNull();
  expect(debugInfo.otherInfo.customRuleMetaData).not.toBeNull();

  const rulesMetadata = debugInfo.otherInfo.customRuleMetaData;
  const expectedMetadata = {
    created: expect.any(Number),
    origin: "web",
  };

  if (expiresAt !== null) {
    expectedMetadata.expiresAt = expiresAt;
  }

  expect(rulesMetadata).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        metaData: expectedMetadata,
        text: allowlistingFilter,
      }),
    ]),
  );
}

export default () => {
  before(async function () {
    // beforeEach hook in index.js executes after this before hook. Calling beforeEachTasks ensures the options page is opened and focused before updating preferences
    await beforeEachTasks();

    await updateExtPrefAPIKey(initOptionsGeneralTab, "allowlisting_authorizedKeys");
    // Suppress the opening of the update page when the extension is reloaded.
    await reloadExtension(initOptionsGeneralTab);
  });

  afterEach(async function () {
    await removeFilterProgrammatically(initOptionsGeneralTab, allowlistingFilter);
  });

  it("allowlists the page forever", async function () {
    // allowlisting without expiration
    await allowlistPageAndCheck(allowlistingCommand);

    const debugInfo = await sendExtMessage(initOptionsGeneralTab, { command: "getDebugInfo" });
    validateFilterMetadata(debugInfo);
  });

  it("allowlists the page with expiration", async function () {
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
    const commandWithExpiration = { ...allowlistingCommand, options: { expiresAt } };

    // allowlisting with expiration
    await allowlistPageAndCheck(commandWithExpiration);

    const debugInfo = await sendExtMessage(initOptionsGeneralTab, { command: "getDebugInfo" });
    validateFilterMetadata(debugInfo, expiresAt);
  });
};
