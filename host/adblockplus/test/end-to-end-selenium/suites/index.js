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

import { beforeEachTasks } from "@eyeo/test-utils/hooks";
import testServer from "./test-server.js";
import extension from "./smoke/extension.js";
import adFiltering from "./smoke/ad-filtering.js";
import uninstallDefault from "./smoke/uninstall-default.js";
import freeUser from "./premium/free-user.js";
import getPremium from "./premium/get-premium.js";

export default () => {
  beforeEach(async function () {
    await beforeEachTasks();
  });

  describe("Test Server", testServer);

  describe("Smoke Tests - Main", function () {
    describe("Extension", extension);
    describe("Ad Filtering", adFiltering);
  });

  describe("Premium", function () {
    describe("Free user", freeUser);
    describe("Premium user", getPremium);
  });

  // Needs to be the last suite to run because the extension gets uninstalled
  describe("Smoke Tests - Uninstall", uninstallDefault);
};
