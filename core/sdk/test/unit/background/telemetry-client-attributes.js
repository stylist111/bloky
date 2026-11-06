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

import {sha256Prefix} from "../../../src/all/hashing.js";

describe("Client attributes", function() {
  const LEDGER_KEY = "ewe:subscriptionLedger";
  const MV2_BASE = "https://easylist-downloads.adblockplus.org/";
  const MV3_BASE = "https://easylist-downloads.adblockplus.org/v3/full/";
  const TRACKED_FILENAMES = [
    "easylist.txt",
    "exceptionrules.txt",
    "exceptionrules-privacy-friendly.txt",
    "abp-filters-anti-cv.txt",
    "easyprivacy.txt",
    "adblock_premium.txt"
  ];
  const TRACKED_URLS = TRACKED_FILENAMES.flatMap(
    f => [MV2_BASE + f, MV3_BASE + f]
  );

  const EASYLIST_MV3 = MV3_BASE + "easylist.txt";
  const EASYLIST_GERMANY_MV3 = MV3_BASE + "easylistgermany+easylist.txt";
  const ANTI_CV_MV2 = MV2_BASE + "abp-filters-anti-cv.txt";
  const ANTI_CV_MV3 = MV3_BASE + "abp-filters-anti-cv.txt";

  let clientAttributes;

  async function setLedger(entries) {
    await env.browser.storage.local.set({[LEDGER_KEY]: entries});
  }

  async function getFilterListsLedger() {
    const attributes = await clientAttributes.buildClientAttributes();
    const attribute = attributes.find(a => a.key === "filter_lists_ledger");
    return attribute && attribute.values;
  }

  // Expected values for all tracked filter lists, with `absent` for the ones
  // not passed in `recorded`.
  async function expectedValues(recorded = {}) {
    const values = await Promise.all(TRACKED_URLS.map(async url => {
      const hash = await sha256Prefix(url);
      return url in recorded ? `${hash}:${recorded[url]}` : `${hash}:absent`;
    }));
    return values.sort();
  }

  beforeEach(async function() {
    env.configure();
    global.__facts = {};
    clientAttributes = await mock("telemetry/client-attributes.js");
  });

  afterEach(function() {
    delete global.__facts;
  });

  it("still builds the attributes from the facts", async function() {
    global.__facts = {
      installDate: new Date("2023-10-01T01:12:34Z").getTime(),
      installType: "admin",
      filterLists: ["abc"],
      customFiltersCount: 53,
      dynamicRuleCount: 143
    };

    expect(await clientAttributes.buildClientAttributes()).toEqual(
      expect.arrayContaining([
        {
          key: "install_time",
          value: String(new Date("2023-10-01T00:00:00Z").getTime())
        },
        {key: "install_type", value: "admin"},
        {key: "filter_lists", values: ["abc"]},
        {key: "custom_filters_count", value: "50"},
        {key: "dynamic_rule_count", value: "100"}
      ])
    );
  });

  it("leaves out the install type if the fact is missing", async function() {
    global.__facts = {filterLists: ["abc"]};

    const attributes = await clientAttributes.buildClientAttributes();
    expect(attributes.find(a => a.key === "install_type")).toBeUndefined();
  });

  it("reports all tracked filter lists as absent for an empty ledger", async function() {
    const values = await getFilterListsLedger();

    expect(values).toHaveLength(12);
    expect(values).toEqual(await expectedValues());
  });

  it("reports the state and reason of recorded filter lists", async function() {
    await setLedger({
      [ANTI_CV_MV3]: {state: "removed", reason: "user_action", ts: 1},
      [EASYLIST_MV3]: {state: "enabled", reason: "default", ts: 2}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues({
      [ANTI_CV_MV3]: "removed:user_action",
      [EASYLIST_MV3]: "enabled:default"
    }));
  });

  it("reports the latest of several subscribed EasyList variants", async function() {
    await setLedger({
      [EASYLIST_MV3]: {state: "enabled", reason: "default", ts: 1},
      [EASYLIST_GERMANY_MV3]: {state: "enabled", reason: "user_action", ts: 2}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues({
      [EASYLIST_MV3]: "enabled:user_action"
    }));
  });

  it("reports a subscribed EasyList variant over a later removed base EasyList", async function() {
    await setLedger({
      [EASYLIST_MV3]: {state: "removed", reason: "user_action", ts: 2},
      [EASYLIST_GERMANY_MV3]: {state: "enabled", reason: "default", ts: 1}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues({
      [EASYLIST_MV3]: "enabled:default"
    }));
  });

  it("reports a subscribed base EasyList over a later removed EasyList variant", async function() {
    await setLedger({
      [EASYLIST_MV3]: {state: "enabled", reason: "default", ts: 1},
      [EASYLIST_GERMANY_MV3]: {state: "removed", reason: "user_action", ts: 2}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues({
      [EASYLIST_MV3]: "enabled:default"
    }));
  });

  it("reports the latest removal when all EasyList variants are removed", async function() {
    await setLedger({
      [EASYLIST_MV3]: {state: "removed", reason: "migration", ts: 1},
      [EASYLIST_GERMANY_MV3]: {state: "removed", reason: "user_action", ts: 2}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues({
      [EASYLIST_MV3]: "removed:user_action"
    }));
  });

  it("ignores filter lists that aren't tracked", async function() {
    await setLedger({
      "https://example.com/subscription.txt":
        {state: "enabled", reason: "user_action", ts: 1}
    });

    expect(await getFilterListsLedger()).toEqual(await expectedValues());
  });

  it("reports a filter list removed by the migration separately from its replacement", async function() {
    await setLedger({
      [ANTI_CV_MV2]: {state: "removed", reason: "migration", ts: 1}
    });

    const values = await getFilterListsLedger();
    expect(values).toContain(`${await sha256Prefix(ANTI_CV_MV2)}:removed:migration`);
    expect(values).toContain(`${await sha256Prefix(ANTI_CV_MV3)}:absent`);
  });

  it("leaves out the ledger if it can't be read", async function() {
    global.__facts = {filterLists: ["abc"]};
    delete env.browser.declarativeNetRequest;
    env.browser.storage.local.get = async() => {
      throw new Error("Storage error");
    };

    const attributes = await clientAttributes.buildClientAttributes();
    expect(attributes).toEqual([{key: "filter_lists", values: ["abc"]}]);
  });

  it("sorts the values", async function() {
    await setLedger({
      [ANTI_CV_MV3]: {state: "removed", reason: "user_action", ts: 1},
      [EASYLIST_MV3]: {state: "enabled", reason: "default", ts: 2}
    });

    const values = await getFilterListsLedger();
    expect(values).toEqual([...values].sort());
  });

  describe("static rule capacity", function() {
    const CAPACITY_KEYS = [
      "available_static_rule_count",
      "enabled_static_rule_count"
    ];

    async function getCapacityAttributes() {
      const attributes = await clientAttributes.buildClientAttributes();
      return attributes.filter(a => CAPACITY_KEYS.includes(a.key));
    }

    beforeEach(function() {
      global.__facts = {filterLists: ["abc"]};
      env.setRecommendations([
        {id: "easylist", ruleCount: 46116},
        {id: "exceptionrules", ruleCount: 8209},
        {id: "easyprivacy", ruleCount: 53663}
      ]);
      env.browser.declarativeNetRequest.getAvailableStaticRuleCount =
        async() => 7531;
      env.browser.declarativeNetRequest.getEnabledRulesets =
        async() => ["easylist", "exceptionrules"];
    });

    it("reports the available and enabled static rule counts with low precision", async function() {
      expect(await getCapacityAttributes()).toEqual([
        {key: "available_static_rule_count", value: "8000"},
        {key: "enabled_static_rule_count", value: "50000"}
      ]);
    });

    it("leaves out the static rule counts on Manifest V2", async function() {
      delete env.browser.declarativeNetRequest;

      expect(await getCapacityAttributes()).toEqual([]);
    });

    it("leaves out the static rule counts if the browser doesn't report a number", async function() {
      env.browser.declarativeNetRequest.getAvailableStaticRuleCount =
        async() => null;

      expect(await getCapacityAttributes()).toEqual([]);
    });

    it("leaves out the static rule counts if the browser can't be queried", async function() {
      env.browser.declarativeNetRequest.getAvailableStaticRuleCount =
        async() => {
          throw new Error("DNR error");
        };

      const attributes = await clientAttributes.buildClientAttributes();
      expect(attributes.filter(a => CAPACITY_KEYS.includes(a.key))).toEqual([]);
      expect(attributes).toEqual(
        expect.arrayContaining([{key: "filter_lists", values: ["abc"]}])
      );
    });
  });
});
