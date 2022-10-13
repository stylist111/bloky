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

import {Filter, InvalidFilter, ContentFilter, AllowingFilter, URLFilter,
        isActiveFilter} from "adblockpluscore/lib/filterClasses.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {SpecialSubscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {isValidHostname} from "adblockpluscore/lib/url.js";
import {RESOURCE_TYPES, contentTypes}
  from "adblockpluscore/lib/contentTypes.js";
import {filterEngine} from "./core.js";
import {createConverter} from "adblockpluscore/lib/dnr/index.js";
import {ERROR_DUPLICATE_FILTERS, ERROR_FILTER_NOT_FOUND,
        ERROR_TOO_MANY_FILTERS} from "../errors.js";

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

      let result = Prefs.dynamic_filters;
      if (Array.isArray(result) && result.length > 0)
        dynamicFilters = new Map(result);
      else
        // DNR rules persist after the extension is uninstalled. The same cannot
        // be said for storage. To be safe, if we have no record of dynamic
        // filters let's clear any DNR rules too.
        await removeDynamicFilters();

      for (let {ruleIds} of dynamicFilters.values())
        setHighestRuleId(ruleIds);
    })();
  }

  return initializationPromise;
}

async function getRules(filter, useFilterEngine) {
  let ruleIds = [];
  let filterRules = [];

  if (filter instanceof URLFilter) {
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

    if (result.length == 0 && !useFilterEngine)
      throw new Error(`Filter unsupported by DNR: ${filter.text}`);
  }

  return {filterRules, ruleIds};
}

async function processFilterTexts(texts) {
  let details = [];
  let add = [];
  let exist = [];
  let seenFilterTexts = new Set();

  texts = texts.map(Filter.normalize);
  for (let text of texts) {
    if (dynamicFilters.has(text)) {
      exist.push(text);
      continue;
    }

    if (seenFilterTexts.has(text))
      continue;

    let filter = Filter.fromText(text);
    let error = validateFilter(filter);
    if (error)
      throw error;

    let useFilterEngine = filter instanceof ContentFilter ||
                          filter instanceof AllowingFilter ||
                          (filter.contentType & contentTypes.WEBRTC ||
                           filter.contentType & contentTypes.POPUP) &&
                          filter.contentType != RESOURCE_TYPES;

    if (!filterEngine.filterStorage.filterState.isEnabled(text)) {
      details.push({filter, useFilterEngine, ruleIds: [], enabled: false});
    }
    else {
      let {filterRules, ruleIds} = await getRules(filter, useFilterEngine);
      add.push(...filterRules);
      details.push({filter, useFilterEngine, ruleIds, enabled: true});
    }

    seenFilterTexts.add(text);
  }

  return {add, exist, details};
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
    if (length >= await dynamicRulesAvailable())
      throw new FilterError(ERROR_TOO_MANY_FILTERS);

    // so that this would throw the right error in case
    // browser.declarativeNetRequest doesn't exist or if
    // the API returned a different error instead
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: filters.add
    });
  }

  for (let filterDetails of filters.details) {
    let {filter, useFilterEngine, ruleIds, enabled} = filterDetails;

    if (useFilterEngine)
      await filterEngine.filterStorage.addFilter(filter);
    else
      filterNotifier.emit("filter.added", filter, null);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text,
                       {ruleIds, useFilterEngine, enabled, metadata});
  }

  storeDynamicFilters();
}

export function setMetadataForFilter(text, metadata) {
  let details = dynamicFilters.get(text);
  if (!details)
    throw new FilterError(ERROR_FILTER_NOT_FOUND);

  details.metadata = metadata;

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
      if (details.useFilterEngine)
        filterEngine.filterStorage.removeFilter(Filter.fromText(text));
      else
        filterNotifier.emit("filter.removed", Filter.fromText(text), null);

      dynamicFilters.delete(text);
    }
    else {
      if (details.useFilterEngine)
        filterEngine.filterStorage.filterState.setEnabled(text, false);
      else
        filterNotifier.emit("filterState.enabled", text, false, true);

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

    let {useFilterEngine} = details;
    let filter = Filter.fromText(normalized);

    if (useFilterEngine)
      filterEngine.filterStorage.filterState.setEnabled(filter.text, true);
    else
      filterNotifier.emit("filterState.enabled", normalized, true, false);

    let {filterRules, ruleIds} = await getRules(filter, useFilterEngine);
    rules.push(...filterRules);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text,
                       {ruleIds, useFilterEngine, enabled: true});
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

export async function migrateCustomFilters() {
  let data = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (!(subscription instanceof SpecialSubscription))
      continue;

    for (let text of subscription.filterText())
      data.push({text, metadata: subscription.metadata});
  }

  for (let entry of data) {
    try {
      filterEngine.filterStorage.removeFilter(Filter.fromText(entry.text));
      await addFilters([entry.text], entry.metadata);
    }
    catch (e) {
      Prefs.migration_errors.push({
        error: e.message,
        text: entry.text
      });
    }
  }
}
