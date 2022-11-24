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

export function rulesetExistsInManifest(rulesetId) {
  let manifest = browser.runtime.getManifest();

  return manifest.declarative_net_request &&
    manifest.declarative_net_request.rule_resources &&
    manifest.declarative_net_request.rule_resources.find(
      ruleset => ruleset.id == rulesetId
    );
}

export async function subscriptionFileExists(subscription, path) {
  let subscriptionPath = `${path}/${subscription.id}`;
  const url = browser.runtime.getURL(subscriptionPath);
  try {
    const fetchResult = await fetch(url, {method: "HEAD"});
    return fetchResult.ok;
  }
  catch (error) {
    return false;
  }
}
