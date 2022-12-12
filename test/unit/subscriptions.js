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

let subCircumvention = {
  id: "D4028CDD-3D39-4624-ACC7-8140F4EC3238",
  type: "circumvention",
  title: "ABP filters",
  homepage: "https://github.com/abp-filters/abp-filters-anti-cv",
  url: "https://easylist-downloads.adblockplus.org/v3/full/abp-filters-anti-cv.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
};

let subEasylist = {
  id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
  type: "ads",
  languages: [
    "en"
  ],
  title: "EasyList",
  homepage: "https://easylist.to/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt"
};

let subAcceptableAds = {
  id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
  type: "allowing",
  title: "Allow nonintrusive advertising",
  homepage: "https://acceptableads.com/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
};

describe("EWE.subscriptions", function() {
  let subscriptions;

  async function mockAndImport() {
    subscriptions = (await mock("subscriptions.js")).default;
  }

  beforeEach(async function() {
    await env.configure();
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

    it("throws if no current language subscription is provided", async function() {
      env.setRecommendations([subEasylist]); // "en"
      await expect(subscriptions.addDefaults("de"))
        .rejects.toThrow("No current language subscription");
    });

    it("throws if no anti-circumvention subscription is provided", async function() {
      env.setRecommendations([subEasylist, subAcceptableAds]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No anti-circumvention subscription");
    });

    it("throws if no allowing subscription is provided", async function() {
      env.setRecommendations([subEasylist, subCircumvention]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No allowing subscription");
    });
  });
});
