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
import {convertFilter as getRulesFromFilter} from "abp2dnr/lib/abp2dnr.js";

import {Filter, InvalidFilter, ContentFilter, AllowingFilter, URLFilter,
        isActiveFilter} from "adblockpluscore/lib/filterClasses.js";
import {isValidHostname} from "adblockpluscore/lib/url.js";
import {RESOURCE_TYPES, contentTypes}
  from "adblockpluscore/lib/contentTypes.js";
import {filterStorage} from "adblockpluscore/lib/filterStorage.js";
import {filterState} from "adblockpluscore/lib/filterState.js";

import {FilterError} from "./types.js";

let highestRuleId = 1;
let dynamicFilters = new Map();
let initializationPromise;

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
  await browser.storage.local.remove(["dynamicFilters"]);

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
  return browser.storage.local.set({
    dynamicFilters: Object.fromEntries(dynamicFilters)
  });
}

export function init() {
  if (!initializationPromise) {
    initializationPromise = (async() => {
      if (!browser.declarativeNetRequest)
        return;

      let result = await browser.storage.local.get(["dynamicFilters"]);

      if ("dynamicFilters" in result)
        dynamicFilters = new Map(Object.entries(result.dynamicFilters));
      else
        // DNR rules persist after the extension is uninstalled. The same cannot
        // be said for storage.local. To be safe, if we have no record of
        // dynamic filters let's clear any DNR rules too.
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
    let result = await getRulesFromFilter(
      filter, browser.declarativeNetRequest.isRegexSupported
    );

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
  let rules = [];
  let seenFilterTexts = new Set();

  texts = texts.map(Filter.normalize);
  for (let text of texts) {
    if (dynamicFilters.has(text) || seenFilterTexts.has(text))
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

    let {filterRules, ruleIds} = await getRules(filter, useFilterEngine);
    rules.push(...filterRules);

    seenFilterTexts.add(text);
    details.push({filter, useFilterEngine, ruleIds});
  }

  return {rules, details};
}

export async function addFilters(texts) {
  await init();

  let filtersToAdd = await processFilterTexts(texts);
  if (filtersToAdd.rules.length > 0) {
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: filtersToAdd.rules
    });
  }

  for (let filterDetails of filtersToAdd.details) {
    let {filter, useFilterEngine, ruleIds} = filterDetails;

    if (useFilterEngine)
      filterStorage.addFilter(filter);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text,
                       {ruleIds, useFilterEngine, enabled: true});
  }

  await storeDynamicFilters();
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
        filterStorage.removeFilter(Filter.fromText(text));

      dynamicFilters.delete(text);
    }
    else {
      if (details.useFilterEngine)
        filterState.setEnabled(text, false);

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

  await storeDynamicFilters();
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
      filterState.setEnabled(filter, true);

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

  await storeDynamicFilters();
}

export async function getDynamicFilters() {
  await init();
  return dynamicFilters;
}
