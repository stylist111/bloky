/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2020-present eyeo GmbH
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

import path from "path";

import { findProjectRoot } from "@eyeo/test-utils";
import {
  cleanupHook,
  seleniumScreenshotsHook,
  setupBrowserHook
} from "./hooks.mjs";
import createWdioPolyfill from "../polyfills/webdriverio-polyfill.mjs";
import testRegularScenarios from "../tests/index.mjs";

// [IMPORTANT]: Set a unique runner ID
global.runnerId = "currentBuild";

const rootPath = findProjectRoot();
const releaseBuildsDirPath = path.join(rootPath, "dist", "release");

describe("Adblock Plus end-to-end tests (webdriverIO)", function () {
  before(async function () {
    // This section downloads the browser, which could take a long time
    // depending on the internet connection speed. Best to disable the normal
    // timeout for this bit.
    this.timeout(0);

    // path to zip files from the latest released build
    const unpackedDirPath = path.join(releaseBuildsDirPath, "ext-unpacked");

    // Start the browser with the extension.
    // Once the driver and other variables are moved on "global" object
    // we can remove the bind(this) from the setupBrowserHook
    await setupBrowserHook.bind(this)(releaseBuildsDirPath, unpackedDirPath);

    // Import the polyfill after setupBrowserHook completes
    // This will make sure that previous tests (written for WebdriverIO) can
    // execute in the context of selenium-webdriver
    const { driver, browserName, fullBrowserVersion } = global;
    const [browser, $, $$] = createWdioPolyfill(
      driver,
      browserName,
      fullBrowserVersion
    );
    global.browser = browser;
    global.$ = $;
    global.$$ = $$;
  });

  afterEach(seleniumScreenshotsHook);
  after(cleanupHook);

  testRegularScenarios();
});
