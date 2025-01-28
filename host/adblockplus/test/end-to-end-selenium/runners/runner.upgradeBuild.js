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

/* eslint-disable no-console */

import { downloadLatestReleaseBuilds } from "@eyeo/test-utils";
import {
  setGlobalOptionsHook,
  cleanupHook,
  prepareExtensionHook,
  screenshotsHook,
  setupBrowserHook
} from "@eyeo/test-utils/hooks";

import defineTestSuitesAfterUpgrade from "../suites/index-upgrade.js";
import { runnerConfig } from "./config.js";

describe("Adblock Plus end-to-end tests - Upgrade extension (selenium)", function () {
  before(() => setGlobalOptionsHook(runnerConfig));

  before(async function () {
    // This section downloads the browser, which could take a long time
    // depending on the internet connection speed. Best to disable the normal
    // timeout for this bit.
    this.timeout(0);

    const {
      browserName,
      manifestVersion,
      liveBuildsDirPath,
      unpackedUpgradeDirPath
    } = runnerConfig;

    try {
      await downloadLatestReleaseBuilds({
        extName: "adblockplus",
        browserName: browserName === "firefox" ? "firefox" : "chrome",
        manifestVersion,
        outputDirPath: liveBuildsDirPath
      });
    } catch (e) {
      console.error("Unable to fetch the latest release builds", e);
    }

    // Start the browser with the extension.
    await setupBrowserHook(liveBuildsDirPath, unpackedUpgradeDirPath);
  });

  before(prepareExtensionHook);

  afterEach(screenshotsHook);
  after(cleanupHook);

  defineTestSuitesAfterUpgrade();
});
