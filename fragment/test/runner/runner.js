/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  cleanupHook,
  setGlobalOptionsHook,
  prepareExtensionHook,
  screenshotsHook,
  setupBrowserHook,
} from "@eyeo/test-utils/hooks";
import defineTestSuites from "../suites/index.js";

import { runnerConfig } from "./config.js";

describe("Fragments Tests", function () {
  before(() => setGlobalOptionsHook(runnerConfig));

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
