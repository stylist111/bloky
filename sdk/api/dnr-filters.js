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

import {Filter, InvalidFilter, URLFilter, isActiveFilter}
  from "adblockpluscore/lib/filterClasses.js";
import {SpecialSubscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {isValidHostname} from "adblockpluscore/lib/url.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {filterEngine} from "./core.js";
import {createConverter} from "adblockpluscore/lib/dnr/index.js";
import {ERROR_DUPLICATE_FILTERS, ERROR_FILTER_NOT_FOUND,
        ERROR_TOO_MANY_FILTERS} from "../errors.js";
import {onChanged} from "./filters.js";

import {FilterError} from "./types.js";
import {Prefs} from "./prefs.js";

let highestRuleId = 1;
let dynamicFilters = new Map();
let initializationPromise;

let getRulesFromFilter = () => {};
if (browser.declarativeNetRequest) {
  getRulesFromFilter = createConverter({
    isRegexSupported: browser.declarativeNetRequest.isRegexSupported
  });
}

/**
 * Update a dynamic subscription.
 *
 * @param {Subscription} subscription The subscription updated.
 * @param {?object} updates The list of added and removed filter text. If
 *   falsey then nothing happens.
 *
 * @private
 */
async function dynamicSubscriptionUpdate(subscription, updates) {
  if (!browser.declarativeNetRequest || !updates)
    return;

  // For now we only want to handle subscription that are in the
  // recommendations.
  if (!subscription.type)
    return;

  let {added, removed} = updates;

  let filters = await processFilterTexts(added, subscription.id);
  // Adding subscription.id into existing filter
  for (let text of filters.existOnOtherSubscription) {
    let filter = dynamicFilters.get(text);
    filter.subscriptionIds.push(subscription.id);
  }

  // Removing subscription.id from existing filter
  removed = removed.filter(text => {
    let detail = dynamicFilters.get(text);
    if (detail && detail.subscriptionIds) {
      let index = detail.subscriptionIds.indexOf(subscription.id);
      if (index !== -1)
        detail.subscriptionIds.splice(index, 1);
      return detail.subscriptionIds.length == 0;
    }
    return false;
  });

  let removeRuleIds = removed.flatMap(text => {
    let detail = dynamicFilters.get(text);
    return detail ? detail.ruleIds : [];
  });

  // Empty array cause exceptions. Make it `undefined`.
  if (removeRuleIds.length == 0)
    removeRuleIds = void 0;

  await browser.declarativeNetRequest.updateDynamicRules(
    {addRules: filters.add, removeRuleIds}
  );

  removed.forEach(text => dynamicFilters.delete(text));

  filters.details.forEach(details => {
    let {useFilterEngine, filter, ruleIds, enabled} = details;

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text,
                       {ruleIds, useFilterEngine, enabled, metadata: {},
                        subscriptionIds: [subscription.id]});
  });

  storeDynamicFilters();
}

export function validateFilter(filter) {
  if (filter instanceof InvalidFilter)
    return new FilterError("invalid_filter", filter.reason, filter.option);

  if (isActiveFilter(filter) && filter.domains) {
    for (let domain of filter.domains.keys()) {
      if (domain && !isValidHostname(domain))
        return new FilterError("invalid_domain", domain);
    }
  }

  return null;
}

export async function removeDynamicFilters() {
  if (!browser.declarativeNetRequest)
    return;

  dynamicFilters = new Map();
  Prefs.dynamic_filters = [];

  let rules = await browser.declarativeNetRequest.getDynamicRules();
  if (rules.length == 0)
    return;

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id)
  });

  return rules;
}

function setHighestRuleId(ruleIds) {
  if (!ruleIds)
    return;

  for (let id of ruleIds) {
    if (highestRuleId < id)
      highestRuleId = id;
  }
}

function storeDynamicFilters() {
  let storageArray = [];
  storageArray.push(...dynamicFilters);
  Prefs.dynamic_filters = storageArray;
}

export function init() {
  if (!initializationPromise) {
    initializationPromise = (async() => {
      if (!browser.declarativeNetRequest)
        return;

      let dynamicFilterArray = Prefs.dynamic_filters;
      if (Array.isArray(dynamicFilterArray) &&
          dynamicFilterArray.length > 0)
        dynamicFilters = new Map(dynamicFilterArray);
      else
        // DNR rules persist after the extension is uninstalled. The same cannot
        // be said for storage. To be safe, if we have no record of dynamic
        // filters let's clear any DNR rules too.
        await removeDynamicFilters();

      for (let {ruleIds} of dynamicFilters.values())
        setHighestRuleId(ruleIds);

      filterNotifier.on("subscription.updated", dynamicSubscriptionUpdate);
    })();
  }

  return initializationPromise;
}

async function getRules(filter) {
  let ruleIds = [];
  let filterRules = [];

  // "sitekey" option is not supported in DNR
  if (filter instanceof URLFilter && !filter.sitekeys) {
    let result = await getRulesFromFilter(filter.text);
    if (result.name == "Error") {
      let {option} = result.detail;
      throw new FilterError(result.message, result.detail.text, option);
    }

    for (let rule of result) {
      let id = ++highestRuleId;
      rule.id = id;
      ruleIds.push(id);
      filterRules.push(rule);
    }
  }

  return {filterRules, ruleIds};
}

async function processFilterTexts(texts, subscriptionId = null) {
  let details = [];
  let add = [];
  let exist = [];
  let existOnOtherSubscription = [];
  let seenFilterTexts = new Set();

  texts = texts.map(Filter.normalize);
  for (let text of texts) {
    let dynamicFilterToAnalyze = dynamicFilters.get(text);
    if (dynamicFilterToAnalyze) {
      let subscriptionIds = dynamicFilterToAnalyze.subscriptionIds || [null];
      if (subscriptionIds.includes(subscriptionId))
        exist.push(text);
      else
        existOnOtherSubscription.push(text);
      continue;
    }

    if (seenFilterTexts.has(text))
      continue;

    let filter = Filter.fromText(text);
    let error = validateFilter(filter);
    if (error)
      throw error;

    if (!filterEngine.filterStorage.filterState.isEnabled(text)) {
      details.push({filter, ruleIds: [], enabled: false});
    }
    else {
      let {filterRules, ruleIds} = await getRules(filter);
      add.push(...filterRules);
      details.push({filter, ruleIds, enabled: true});
    }

    seenFilterTexts.add(text);
  }

  return {add, exist, existOnOtherSubscription, details};
}

async function dynamicRulesAvailable() {
  let {declarativeNetRequest} = browser;
  if (!declarativeNetRequest)
    return Infinity;

  const {MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES} = declarativeNetRequest;
  let used = (await declarativeNetRequest.getDynamicRules()).length +
               (await declarativeNetRequest.getSessionRules()).length;
  return MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES - used;
}

export async function addFilters(texts, metadata) {
  await init();
  let filters = await processFilterTexts(texts);
  if (filters.exist.length > 0)
    throw new FilterError(ERROR_DUPLICATE_FILTERS);

  let {length} = filters.add;
  if (length > 0) {
    // always false when !browser.declarativeNetRequest
    if (length > await dynamicRulesAvailable())
      throw new FilterError(ERROR_TOO_MANY_FILTERS);

    // so that this would throw the right error in case
    // browser.declarativeNetRequest doesn't exist or if
    // the API returned a different error instead
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: filters.add
    });
  }

  for (let text of filters.existOnOtherSubscription) {
    let filter = dynamicFilters.get(text);
    if (!filter.subscriptionIds)
      filter.subscriptionIds = [];
    filter.subscriptionIds.push(null);
  }

  let subscription;
  for (let filterDetails of filters.details) {
    let {filter, ruleIds, enabled} = filterDetails;
    subscription = await filterEngine.filterStorage
      .addFilter(filter, subscription);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text, {ruleIds, enabled, metadata,
                                     subscriptionIds: [null]});
  }

  storeDynamicFilters();
}

export function setMetadataForFilter(text, metadata) {
  let details = dynamicFilters.get(text);
  if (!details)
    throw new FilterError(ERROR_FILTER_NOT_FOUND);

  let oldMetadata = details.metadata;
  details.metadata = metadata;
  onChanged.emit({...Filter.fromText(text), metadata, oldMetadata},
                 "metadata");

  storeDynamicFilters();
}

export function getMetadataForFilter(text) {
  let details = dynamicFilters.get(text);
  if (!details)
    return null;

  let metadata = details.metadata;
  return (typeof metadata != "undefined") ? metadata : null;
}

export async function removeOrDisableFilters(texts, remove = true) {
  await init();

  let filtersToRemove = texts.map(Filter.normalize);
  let ruleIdsToRemove = [];
  for (let text of filtersToRemove) {
    if (!dynamicFilters.has(text))
      continue;

    for (let ruleId of dynamicFilters.get(text).ruleIds)
      ruleIdsToRemove.push(ruleId);

    let details = dynamicFilters.get(text);

    if (remove) {
      // Removing existing filter
      if (details) {
        if (!details.subscriptionIds)
          details.subscriptionIds = [];

        let index = details.subscriptionIds.indexOf(null);
        if (index !== -1)
          details.subscriptionIds.splice(index, 1);
      }
      // Removing filter only if subscriptionIds array is empty
      if (details.subscriptionIds && details.subscriptionIds.length >= 0) {
        filterEngine.filterStorage.removeFilter(Filter.fromText(text));

        dynamicFilters.delete(text);
      }
    }
    else {
      filterEngine.filterStorage.filterState.setEnabled(text, false);

      details.enabled = false;
      details.ruleIds = [];
      dynamicFilters.set(text, details);
    }
  }

  if (ruleIdsToRemove.length > 0) {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove
    });
  }

  storeDynamicFilters();
}

export async function enableFilters(texts) {
  await init();

  let rules = [];

  for (let text of texts) {
    let normalized = Filter.normalize(text);
    let details = dynamicFilters.get(normalized);

    if (!details || details.enabled)
      continue;

    let filter = Filter.fromText(normalized);
    filterEngine.filterStorage.filterState.setEnabled(filter.text, true);

    let {filterRules, ruleIds} = await getRules(filter);
    rules.push(...filterRules);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text, {ruleIds, enabled: true});
  }

  if (rules.length == 0)
    return;

  await browser.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });

  storeDynamicFilters();
}

export async function getDynamicFilters() {
  await init();
  return dynamicFilters;
}

export async function getDynamicUserFilters() {
  await init();
  let dynamicUserFilters = new Map();

  for (let [filterText, details] of dynamicFilters.entries()) {
    if (!details.subscriptionIds || details.subscriptionIds.includes(null))
      dynamicUserFilters.set(filterText, details);
  }
  return dynamicUserFilters;
}

export async function migrateCustomFilters() {
  let filters = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (!(subscription instanceof SpecialSubscription))
      continue;

    for (let text of subscription.filterText())
      filters.push({text, metadata: subscription.metadata});
  }

  for (let filter of filters) {
    try {
      filterEngine.filterStorage.removeFilter(Filter.fromText(filter.text));
      await addFilters([filter.text], filter.metadata);
    }
    catch (e) {
      let errors = Prefs.migration_filter_errors;
      errors.push({error: e.message, filter});
      Prefs.migration_filter_errors = errors;
    }
  }
}
