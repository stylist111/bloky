/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

import {subAntiCVLocal, subEasylistLocal, subAcceptableAdsLocal}
  from "../api-fixtures.js";

describe("EWE.subscriptions", function() {
  let subscriptions;

  async function mockAndImport() {
    subscriptions = (await mock("subscriptions.js")).default;
  }

  beforeEach(async function() {
    env.configure();
    await mockAndImport();
    env.setRecommendations([]);
    env.setFilterStorageSubscriptions([]);
  });

  describe("addDefaults()", function() {
    it("throws if no default language subscription is provided", async function() {
      env.setRecommendations([]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No default language subscription");
    });

    it("throws if no anti-circumvention subscription is provided", async function() {
      env.setRecommendations([subEasylistLocal, subAcceptableAdsLocal]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No anti-circumvention subscription");
    });

    it("throws if no allowing subscription is provided", async function() {
      env.setRecommendations([subEasylistLocal, subAntiCVLocal]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No allowing subscription");
    });
  });
});
