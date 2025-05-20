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

import {
  beforeEachTasks,
  setSmokeTestsFailed,
  skipWhenSmokeTestsFailed,
} from "@eyeo/test-utils/hooks";
import dataCollection from "./data-collection/data-collection.js";
import extension from "./smoke/extension.js";
import adFiltering from "./smoke/ad-filtering.js";
import uninstall from "./smoke/uninstall.js";
import optionsPageAA from "./options-page/acceptable-ads.js";
import optionsPageFL from "./options-page/filter-lists.js";
import getPremium from "./premium/get-premium.js";
import popupElements from "./popup-page/popup-elements.js";
import freeUserOptions from "./premium/free-user-options.js";
import freeUserPopup from "./premium/free-user-popup.js";
import testServer from "./test-server.js";
import oneClickAllowlisting from "./public-api/one-click-allowlisting.js";
import bypassAPI from "./public-api/bypass-api.js";
import eyeometry from "./data-collection/eyeometry.js";
import youtubeAutoAllowlist from "./youtube-auto-allowlist.js";
import helpFlow from "./popup-page/helpflow.js";
import infoInjector from "./info-injector.js";
import campaigns from "./ipm/campaigns.js";

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

    describe("Popup Page", function () {
      describe("Popup elements", popupElements);
      describe("Helpflow", helpFlow);
    });
    describe("Options Page", function () {
      describe("Acceptable Ads", optionsPageAA);
      describe("Filter Lists", optionsPageFL);
    });

    describe("Data Collection", function () {
      dataCollection();
      describe("Eyeometry", eyeometry);
    });

    describe("IPM", function () {
      describe("Campaigns", campaigns);
    });

    describe("YouTube auto-allowlist", youtubeAutoAllowlist);

    describe("Info Injector", infoInjector);

    describe("Public API", function () {
      describe("One click allowlisting", oneClickAllowlisting);
      describe("Bypass API", bypassAPI);
    });

    describe("Premium", function () {
      describe("Free user - Popup", freeUserPopup);
      describe("Free user - Options", freeUserOptions);
      describe("Premium user", getPremium);
    });
    // Needs to be the last suite to run because the extension gets uninstalled
    describe("Smoke Tests - Uninstall", uninstall);
  });
};
