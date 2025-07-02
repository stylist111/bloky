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
  beforeEachTasks,
  setSmokeTestsFailed,
  skipWhenSmokeTestsFailed
} from "@eyeo/test-utils/hooks";
import testServer from "./test-server.js";
import extension from "./smoke/extension.js";
import adFiltering from "./smoke/ad-filtering.js";
import optionsPageAA from "./options-page/acceptable-ads.js";
import optionsPageFL from "./options-page/filter-lists.js";
import popupPage from "./popup-page.js";
import uninstallDefault from "./smoke/uninstall-default.js";
import freeUser from "./premium/free-user.js";
import getPremium from "./premium/get-premium.js";
import eyeometry from "./eyeometry.js";
import youtubeAllowlist from "./youtube-auto-allowlist.js";
import oneClickAllowlisting from "./public-api/one-click-allowlisting.js";
import bypassAPI from "./public-api/bypass-api.js";
import experiments from "./public-api/trusted-iframe-experiments.js";
import getStatus from "./public-api/trusted-iframe-get-status.js";
import infoInjector from "./info-injector.js";

export default () => {
  beforeEach(async function () {
    await beforeEachTasks();
  });

  describe("Test Server", testServer);

  describe("Smoke Tests", function () {
    afterEach(setSmokeTestsFailed);

    describe("Extension", extension);
    describe("Ad Filtering", adFiltering);
  });

  describe("Regression tests", function () {
    before(skipWhenSmokeTestsFailed);

    describe("Popup Page", popupPage);

    describe("Options Page", function () {
      describe("Acceptable Ads", optionsPageAA);
      describe("Filter Lists", optionsPageFL);
    });

    describe("Eyeometry", eyeometry);

    describe("Info Injector", infoInjector);

    describe("Youtube Allowlist", youtubeAllowlist);

    describe("Public API", function () {
      describe("One click allowlisting", oneClickAllowlisting);
      describe("Bypass API", bypassAPI);
      describe("Trusted iframe experiments", experiments);
      describe("Trusted iframe get status", getStatus);
    });

    describe("Premium", function () {
      describe("Free user", freeUser);
      describe("Premium user", getPremium);
    });

    // Needs to be the last suite to run because the extension gets uninstalled
    describe("Smoke Tests - Uninstall", uninstallDefault);
  });
};
