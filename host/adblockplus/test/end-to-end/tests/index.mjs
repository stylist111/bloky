/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
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

import { afterSequence, beforeSequence } from "../helpers.js";
import advancedTabFL from "./test-advanced-tab-filter-lists.mjs";
import flDropdown from "./test-built-in-filter-list-dropdown.mjs";
import publicAPI from "./public-api/index.mjs";
import eyeometry from "./test-eyeometry.mjs";
import youtubeAutoAllowlist from "./test-youtube-auto-allowlist.mjs";
import testServer from "./smoke-main/test-server.js";

export default () => {
  describe("Regular tests", function () {
    before(async function () {
      const { origin, optionsUrl, installedUrl, popupUrl, extVersion } =
        await beforeSequence({ expectInstalledTab: true, isSmokeTest: true });
      global.globalOrigin = origin;
      global.optionsUrl = optionsUrl;
      global.installedUrl = installedUrl;
      global.popupUrl = popupUrl;
      global.extVersion = extVersion;
    });

    beforeEach(async function () {
      await afterSequence();
    });

    describe("Test Server", testServer);
    describe("Advanced Tab - Filter Lists", advancedTabFL);
    describe("Filter List Dropdown - Default Filter Lists", flDropdown);
    describe("Public API", publicAPI);
    describe("Eyeometry", eyeometry);
    describe("YouTube Auto-allowlist", youtubeAutoAllowlist);
  });
};
