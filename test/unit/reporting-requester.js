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
import {encode} from "../../sdk/api/id-utils.js";

describe("Reporting requester", function() {
  let api;

  const TAB_ID1 = 1;
  const TAB_ID2 = 2;
  const RULE_ID1 = 11;
  const RULE_ID2 = 12;
  const TIMESTAMP1 = Date.now();
  const TIMESTAMP2 = Date.now() + 10;
  let rulesMatchedInfo = [
    {
      rule: {
        ruleId: RULE_ID1,
        rulesetId: env.browser.declarativeNetRequest.DYNAMIC_RULESET_ID
      },
      tabId: TAB_ID1,
      timeStamp: TIMESTAMP1
    },
    {
      rule: {
        ruleId: RULE_ID2,
        rulesetId: env.browser.declarativeNetRequest.DYNAMIC_RULESET_ID
      },
      tabId: TAB_ID2,
      timeStamp: TIMESTAMP2
    }
  ];

  async function mockAndImport() {
    api = await mock("reporting-requester.js");
  }

  let ruleIds;

  beforeEach(async function() {
    await env.configure();
    await mockAndImport();
    ruleIds = [];
    // eslint-disable-next-line no-undef
    global.getFilterTextByRuleId = id => {
      ruleIds.push(id);
      return String(id);
    };
  });

  it("does NOT filter for tabId if not passed", async function() {
    env.browser.declarativeNetRequest._rulesMatchedInfo = rulesMatchedInfo;

    let info = await api.getMatchedFilters(/* no tabId */);
    expect(info.length).toEqual(2);
    expect(info).toEqual(rulesMatchedInfo);
  });

  it("filters for tabId", async function() {
    env.browser.declarativeNetRequest._rulesMatchedInfo = rulesMatchedInfo;

    let info = await api.getMatchedFilters(TAB_ID1);
    expect(info.length).toEqual(1);
    expect(info[0]).toEqual(rulesMatchedInfo[0]);
  });

  it("does NOT filter for timestamp if not passed", async function() {
    env.browser.declarativeNetRequest._rulesMatchedInfo = rulesMatchedInfo;

    let info = await api.getMatchedFilters(/* no timestamp */);
    expect(info.length).toEqual(2);
    expect(info).toEqual(rulesMatchedInfo);
  });

  it("filters for timestamp", async function() {
    env.browser.declarativeNetRequest._rulesMatchedInfo = rulesMatchedInfo;

    let info = await api.getMatchedFilters(null, TIMESTAMP2);
    expect(info.length).toEqual(1);
    expect(info[0]).toEqual(rulesMatchedInfo[1]);
  });

  it("adds a filter text for dynamic rules", async function() {
    env.browser.declarativeNetRequest._rulesMatchedInfo = rulesMatchedInfo;

    let info = await api.getMatchedFilters();
    expect(info.length).toEqual(2);
    for (let eachInfo of info) {
      expect(eachInfo.text).toEqual(expect.any(String));
      expect(ruleIds.includes(eachInfo.rule.id));
    }
  });

  it("adds a filter text for static rules", async function() {
    const SUBSCRIPTION_ID = "333";
    const SUBSCRIPTION_URL = "someUrl";
    const RULE_INDEX = 0;
    const LINE_NUMBER = 1;
    const FILTER_TEXT = "filterText";
    let SUBSCRIPTION_FILTER_TEXT = [];
    SUBSCRIPTION_FILTER_TEXT[LINE_NUMBER - 1] = FILTER_TEXT;
    // `- 1` due to removed ABP header line

    env.browser.declarativeNetRequest._rulesMatchedInfo = [{
      rule: {
        ruleId: encode(RULE_INDEX, LINE_NUMBER),
        rulesetId: SUBSCRIPTION_ID
      },
      tabId: TAB_ID1,
      timeStamp: TIMESTAMP1
    }];
    env.setRecommendations([{
      id: SUBSCRIPTION_ID,
      url: SUBSCRIPTION_URL
    }]);

    // mocked `Subscriptions.fromURL(url)` impl
    // eslint-disable-next-line no-undef
    global.fromURL = url => {
      if (url == SUBSCRIPTION_URL) {
        return {
          _filterText: SUBSCRIPTION_FILTER_TEXT
        };
      }

      return null;
    };

    let info = await api.getMatchedFilters();
    expect(info.length).toEqual(1);
    expect(info[0].text).toEqual(FILTER_TEXT);
  });
});
