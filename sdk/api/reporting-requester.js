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

import browser from "./browser.js";
import {recommendations} from "adblockpluscore/lib/recommendations.js";
import {decode} from "./id-utils.js";
import {getFilterTextByRuleId} from "./dnr-filters.js";
import {Subscription} from "adblockpluscore/lib/subscriptionClasses.js";

export async function getMatchedFilters(tabId, minTimeStamp) {
  let filter = {};
  if (tabId)
    filter.tabId = tabId;
  if (minTimeStamp)
    filter.minTimeStamp = minTimeStamp;
  let rules = await browser.declarativeNetRequest
    .getMatchedRules(tabId || minTimeStamp ? filter : null);

  let filters = [];
  for (let ruleInfo of rules.rulesMatchedInfo) {
    if (ruleInfo.rule.rulesetId ==
        browser.declarativeNetRequest.DYNAMIC_RULESET_ID) {
      // dynamic rule
      ruleInfo.text = getFilterTextByRuleId(ruleInfo.rule.ruleId);
      filters.push(ruleInfo);
    }
    else {
      // static rule
      let subscriptionId = ruleInfo.rule.rulesetId;
      let subscriptionInfo = Array.from(recommendations())
        .find(x => x.id == subscriptionId);
      if (!subscriptionInfo)
        throw new Error(`Failed to find the subscription with id=${subscriptionId}`);

      let subscription = Subscription.fromURL(subscriptionInfo.url);
      let line = decode(ruleInfo.rule.ruleId).line - 1;
      // `-1` as we remove ABP header
      ruleInfo.text = subscription._filterText[line];
      filters.push(ruleInfo);
    }
  }

  return filters;
}
