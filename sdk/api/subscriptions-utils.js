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

function getRuleset(rulesetId) {
  let manifest = browser.runtime.getManifest();

  if (manifest.declarative_net_request &&
    manifest.declarative_net_request.rule_resources) {
    return manifest.declarative_net_request.rule_resources.find(
      ruleset => ruleset.id == rulesetId
    );
  }

  return null;
}

export function rulesetExistsInManifest(rulesetId) {
  return !!getRuleset(rulesetId);
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

/**
 * Get the subscription static ruleset map
 * @param {string} id The subscription id to get the map for.
 *
 * @private
 * @returns {object} The subscription map. It can be used to
 *     initialize a `Map` with key being the filter text and values
 *     being an array of ids.
 */
export async function getSubscriptionRulesetMap(id) {
  let dnrSub = getRuleset(id);

  if (!dnrSub) {
    throw Error(`Subscription ${id} not found.`);
  }

  const url = browser.runtime.getURL(dnrSub.path + ".map");
  let response = await fetch(url);
  return await response.json();
}
