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

import browser from "webextension-polyfill";
import {getDefaultSubscriptions, ACCEPTABLE_ADS_MV3_URL} from "./default-subscriptions.js";

function rulesetIdForURL(url) {
  // keep in-sync with "adblockpluscore" scripts/fetchSubscriptions.js
  return url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export async function configureDefaultRulesets() {
  let dnr = browser.runtime.getManifest().declarative_net_request;
  let rulesetIds = [];
  let enabledRulesets = await browser.declarativeNetRequest
    .getEnabledRulesets();
  let foundSubscriptions = enabledRulesets.length != 0;

  if (!foundSubscriptions && dnr && dnr.rule_resources) {
    rulesetIds.push(rulesetIdForURL(ACCEPTABLE_ADS_MV3_URL));
    for (let subscription of getDefaultSubscriptions())
      rulesetIds.push(rulesetIdForURL(subscription.url));

    await browser.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: rulesetIds
    });
  }

  return {foundSubscriptions, foundStorage: false};
}
