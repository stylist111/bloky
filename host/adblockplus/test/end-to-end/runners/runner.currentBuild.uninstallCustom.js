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

import {
  cleanupHook,
  setGlobalOptionsHook,
  prepareExtensionHook,
  screenshotsHook,
  setupBrowserHook,
  skipWhenSmokeTestsFailed
} from "@eyeo/test-utils/hooks";
import { runnerConfig } from "./config.js";

import defineTestSuites from "../suites/index-uninstall-custom.js";

describe("Adblock Plus end-to-end tests - Uninstall custom", function () {
  before(() => setGlobalOptionsHook(runnerConfig));

  before(skipWhenSmokeTestsFailed);

  before(async function () {
    // This section downloads the browser, which could take a long time
    // depending on the internet connection speed. Best to disable the normal
    // timeout for this bit.
    this.timeout(0);

    const { buildsDirPath, unpackedDirPath } = runnerConfig;

    // Start the browser with the extension.
    await setupBrowserHook(buildsDirPath, unpackedDirPath);
  });

  before(prepareExtensionHook);

  afterEach(screenshotsHook);
  after(cleanupHook);

  defineTestSuites();
});
