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
import {DnrMapper} from "adblockpluscore/lib/dnr/mapper.js";
import {getSubscriptionRulesetMap} from "./subscriptions-utils.js";
import subscriptions from "./subscriptions.js";
import {ERROR_DUPLICATE_FILTERS, ERROR_FILTER_NOT_FOUND,
        ERROR_TOO_MANY_FILTERS} from "../errors.js";
import {onChangedFilter, disableFilter} from "./filters.js";
import {default as initializer} from "./initializer.js";
import {calculateDiff} from "./filter-diffs.js";

import {FilterError} from "./types.js";
import {Prefs} from "./prefs.js";

let highestRuleId = 1;

// Filter text to related details (enabled, rule ids, subscription ids, etc) map
let dynamicFilters = new Map();

// Subscription id to last diff update map
let lastDiffUpdates = null;

let initializationPromise;

let getRulesFromFilter = () => {};
if (browser.declarativeNetRequest) {
  getRulesFromFilter = createConverter({
    isRegexSupported: browser.declarativeNetRequest.isRegexSupported
  });
}

export async function restoreDynamicRules(subscriptionId) {
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription.id == subscriptionId) {
      ensureRulesetUpdatesLoaded();

      let lastUpdate = lastDiffUpdates.get(subscription.id);
      if (lastUpdate) {
        await _dnrSubscriptionUpdate(subscription, lastUpdate, true);
      }

      break;
    }
  }
}

export async function disableDynamicRules(subscriptionId) {
  let subscriptionDynRules = findDynamicFilters(subscriptionId);
  let {removedDynamicFilters, removeRuleIds} = removeDynamicFilters(
    subscriptionId, [...subscriptionDynRules.keys()]);
  removedDynamicFilters.forEach(text => dynamicFilters.delete(text));
  await browser.declarativeNetRequest.updateDynamicRules({removeRuleIds});
}

// returns a set of filters (texts) that relate to requested subscription
function findDynamicFilters(subscriptionId) {
  let result = new Set();

  for (let [text, detail] of dynamicFilters.entries()) {
    if (detail && detail.subscriptionIds) {
      let index = detail.subscriptionIds.indexOf(subscriptionId);
      if (index !== -1) {
        result.add(text);
      }
    }
  }

  return result;
}

/**
 * Remove the dynamic filters for a subscription.
 *
 * @param {String} subscriptionId The subscription id.
 * @param {Array<String>} filters The filter text array to remove.
 *
 * @return {Object} The rules that were removed.
 *
 * @private
 */
function removeDynamicFilters(subscriptionId, filters) {
  let removedDynamicFilters = filters.filter(text => {
    let detail = dynamicFilters.get(text);
    if (detail && detail.subscriptionIds) {
      let index = detail.subscriptionIds.indexOf(subscriptionId);
      if (index !== -1) {
        detail.subscriptionIds.splice(index, 1);
      }
      return detail.subscriptionIds.length == 0;
    }
    return false;
  });

  let removeRuleIds = removedDynamicFilters.flatMap(text => {
    let detail = dynamicFilters.get(text);
    return detail ? detail.ruleIds : [];
  });

  return {removedDynamicFilters, removeRuleIds};
}

// URLs of the subscriptions that are currently updating
let dnrSubscriptionUpdating = new Set();

export function isDnrSubscriptionUpdating(url) {
  return dnrSubscriptionUpdating.has(url);
}

export function clearIsDnrSubscriptionUpdating() {
  dnrSubscriptionUpdating.clear();
}

/**
 * Update a DNR subscription.
 *
 * @param {Subscription} subscription The subscription updated.
 * @param {?object} updates The list of added and removed filter text. If
 *   falsey then nothing happens.
 *
 * @private
 */
export async function dnrSubscriptionUpdate(subscription, updates) {
  if (isDnrSubscriptionUpdating(subscription.url)) {
    return;
  }
  dnrSubscriptionUpdating.add(subscription.url);

  try {
    await _dnrSubscriptionUpdate(subscription, updates);
  }
  catch (e) {
    if (e.type === ERROR_TOO_MANY_FILTERS){
      subscription.downloadStatus = "synchronize_diff_too_many_filters";
      e.rulesAvailable = await dynamicRulesAvailable();
    }
    else {
      subscription.downloadStatus = "synchronize_diff_error";
    }
    // Here we have to decide what to do with this error
    // Some options:
    //  * add the entire error object as a new property of the subscription
    //  * create a new event under EWE.subscription to notify the error
    //  * leave it as it is, the "too_many_filters" status will be enough
  }
  finally {
    dnrSubscriptionUpdating.delete(subscription.url);
  }
}

export async function removeSubscriptionsDynamicFilters() {
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof SpecialSubscription) {
      continue;
    }

    await disableDynamicRules(subscription.id);
  }
}

export async function enableAllDisabledStaticRules() {
  // Requires Chrome 111+ API
  if (!browser.declarativeNetRequest.updateStaticRules) {
    return;
  }

  let disableRuleIds = [];
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof SpecialSubscription) {
      continue;
    }

    let enableRuleIds =
      await browser.declarativeNetRequest.getDisabledRuleIds({
        rulesetId: subscription.id
      });

    await browser.declarativeNetRequest.updateStaticRules({
      rulesetId: subscription.id,
      disableRuleIds,
      enableRuleIds
    });
  }
}

export async function _dnrSubscriptionUpdate(
  subscription, updates, skipEmitting) {
  if (!browser.declarativeNetRequest || !updates) {
    return;
  }

  // For now we only want to handle subscriptions that are in the
  // recommendations.
  if (!subscription.type) {
    return;
  }

  // We don't have the Chrome 111+ API to update the static rules
  // but this subscription isn't downloadable. So we just can't update.
  if (!subscription.downloadable &&
      !browser.declarativeNetRequest.updateStaticRules) {
    return;
  }

  // Determine if we need to update static rules.
  let needUpdateStaticRules = !subscription.downloadable;

  let {added, removed} = updates;

  // With some path of code the filter engine might not be initialized
  // if the service worker got awaken.
  await initializer.start();

  let rollbackCallback = null;
  let filterTextToRuleIdsMapper = null; // to static rules ids

  // The already disabled static rules ids.
  let disabledStaticRulesIds = null;

  // This will contain the text of all the dynamic filters for the subscription
  // and it will be updated to remove those that are still here.
  let knownDynamicFilters = new Set();

  if (needUpdateStaticRules) {
    filterTextToRuleIdsMapper = new DnrMapper(
      async() => await getSubscriptionRulesetMap(subscription.id)
    );
    disabledStaticRulesIds =
      await browser.declarativeNetRequest.getDisabledRuleIds({
        rulesetId: subscription.id
      });

    ensureRulesetUpdatesLoaded();

    let lastUpdate = lastDiffUpdates.get(subscription.id);

    // All the dynamic filters for this subscription must be removed.
    knownDynamicFilters = findDynamicFilters(subscription.id);

    rollbackCallback = async() => {
      if (!lastUpdate) {
        lastUpdate = {added: [], removed: []};
      }
      await _dnrSubscriptionUpdate(subscription, lastUpdate);
    };
  }

  let filters = await processFilterTexts(
    added, subscription.id, filterTextToRuleIdsMapper);
  if (knownDynamicFilters.size != 0) {
    filters.relateToThisSubscription.forEach(
      text => knownDynamicFilters.delete(text));
  }

  // Adding subscription.id into existing filter
  for (let text of filters.relateToOtherSubscriptions) {
    let filter = dynamicFilters.get(text);
    knownDynamicFilters.delete(text);
    filter.subscriptionIds.push(subscription.id);
  }

  // A union of what is explicitly listed in `removed`
  // and dynamic filters that we had for this subscription previously
  // and not listed in `added` anymore
  let dynamicFiltersToRemove = removed.concat(...knownDynamicFilters.keys());

  // Removing subscription.id from existing filters that are removed.
  let {removedDynamicFilters, removeRuleIds} =
      removeDynamicFilters(subscription.id, dynamicFiltersToRemove);

  if (filters.add.length - removeRuleIds.length >
      await dynamicRulesAvailable()) {
    if (rollbackCallback) {
      await rollbackCallback();
    }
    throw new FilterError(ERROR_TOO_MANY_FILTERS);
  }

  // Empty array cause exceptions. Make it `undefined`.
  if (removeRuleIds.length == 0) {
    removeRuleIds = void 0;
  }

  let subscriptionActive = (await subscriptions.has(subscription.url)) &&
      !subscription.disabled;
  await browser.declarativeNetRequest.updateDynamicRules(
    {addRules: subscriptionActive ? filters.add : void 0, removeRuleIds}
  );

  if (needUpdateStaticRules) {
    if (removed.length > 0) {
      await filterTextToRuleIdsMapper.load();
    }

    let disableRuleIds = removed.flatMap(text => {
      let ids = filterTextToRuleIdsMapper.get(text);
      return ids ? ids : [];
    });
    // Empty array cause exceptions. Make it `undefined`.
    if (disableRuleIds.length == 0) {
      disableRuleIds = void 0;
    }

    let enableRuleIds = [...filters.staticRulesToEnable];
    // Reenable the disabled rules to reset the state:
    // `browser.declarativeNetRequest.updateStaticRules` will handle this
    // properly.
    enableRuleIds.push(...disabledStaticRulesIds);

    // This is Chrome 111+ only.
    await browser.declarativeNetRequest.updateStaticRules({
      rulesetId: subscription.id,
      disableRuleIds,
      enableRuleIds
    });
  }

  removedDynamicFilters.forEach(text => dynamicFilters.delete(text));

  if (subscriptionActive) {
    filters.details.forEach(details => {
      let {useFilterEngine, filter, ruleIds, enabled} = details;

      setHighestRuleId(ruleIds);
      dynamicFilters.set(filter.text,
                         {ruleIds, useFilterEngine, enabled, metadata: {},
                          subscriptionIds: [subscription.id]});
    });
  }

  let storageUpdate = await applyFilterTextUpdate(subscription, updates);

  lastDiffUpdates.set(subscription.id, updates);
  storeRulesetUpdates();
  storeDynamicFilters();

  if (!skipEmitting) {
    // `dnrSubscriptionUpdate()` is currently used for some internal routines,
    // eg. restoring the dynamic rules for the subscription, which does not
    // mean there was a subscription update actually (EE-163), so we might
    // skip emitting the event.
    filterNotifier.emit("subscription.updated", subscription, storageUpdate);
  }
}

/**
 * Apply the filter text update to the subscription.
 *
 * @param {object} subscription The subscription to apply the update to
 * @param {FilterDiffs} updates The update to apply.
 */
export async function applyFilterTextUpdate(subscription, updates) {
  ensureRulesetUpdatesLoaded();

  // apply the update to the storage
  let base = lastDiffUpdates.get(subscription.id);
  let storageUpdate;
  if (base) {
    storageUpdate = calculateDiff(base, updates);
  }
  else {
    storageUpdate = {
      added: updates.added,
      removed: updates.removed
    };
  }

  for (let text of storageUpdate.removed) {
    let index = subscription.findFilterTextIndex(text);
    if (index >= 0) {
      subscription.deleteFilterAt(index);
    }
  }

  for (let text of storageUpdate.added) {
    subscription.addFilterText(text);
  }

  await filterEngine.filterStorage.saveToDisk();
  return storageUpdate;
}

export function validateFilter(filter) {
  if (filter instanceof InvalidFilter) {
    return new FilterError("invalid_filter", filter.reason, filter.option);
  }

  if (isActiveFilter(filter) && filter.domains) {
    for (let domain of filter.domains.keys()) {
      if (domain && !isValidHostname(domain)) {
        return new FilterError("invalid_domain", domain);
      }
    }
  }

  return null;
}

export async function removeAllDynamicFilters() {
  if (!browser.declarativeNetRequest) {
    return;
  }

  dynamicFilters = new Map();
  Prefs.dynamic_filters = [];

  let rules = await browser.declarativeNetRequest.getDynamicRules();
  if (rules.length == 0) {
    return;
  }

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id)
  });

  return rules;
}

function setHighestRuleId(ruleIds) {
  if (!ruleIds) {
    return;
  }

  for (let id of ruleIds) {
    if (highestRuleId < id) {
      highestRuleId = id;
    }
  }
}

function storeDynamicFilters() {
  let storageArray = [];
  storageArray.push(...dynamicFilters);
  Prefs.dynamic_filters = storageArray;
}

function storeRulesetUpdates() {
  let storageArray = [];
  storageArray.push(...lastDiffUpdates);
  Prefs.ruleset_updates = storageArray;
}

function ensureRulesetUpdatesLoaded() {
  if (!lastDiffUpdates) {
    loadRulesetUpdates();
  }
}

function loadRulesetUpdates() {
  let rulesetUpdatesArray = Prefs.ruleset_updates;
  if (!Array.isArray(rulesetUpdatesArray)) {
    rulesetUpdatesArray = [];
  }

  lastDiffUpdates = new Map(rulesetUpdatesArray);
}

export function clearRulesetUpdates() {
  ensureRulesetUpdatesLoaded();
  lastDiffUpdates.clear();
  Prefs.ruleset_updates = [];
}

export function init() {
  if (!initializationPromise) {
    initializationPromise = (async() => {
      if (!browser.declarativeNetRequest) {
        return;
      }

      let dynamicFilterArray = Prefs.dynamic_filters;
      if (Array.isArray(dynamicFilterArray) &&
          dynamicFilterArray.length > 0) {
        dynamicFilters = new Map(dynamicFilterArray);
      }
      else {
        // DNR rules persist after the extension is uninstalled. The same cannot
        // be said for storage. To be safe, if we have no record of dynamic
        // filters let's clear any DNR rules too.
        await removeAllDynamicFilters();
      }

      for (let {ruleIds} of dynamicFilters.values()) {
        setHighestRuleId(ruleIds);
      }

      filterNotifier.on("subscription.dnrUpdated", dnrSubscriptionUpdate);
      filterNotifier.on("subscription.diffReceived", dnrSubscriptionUpdate);
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

/**
 * @typedef {Object} FilterDetails
 * @property {Filter} filter The filter object
 * @property {Array.<number>} ruleIds The rule ids for the filter in
 *   the dynamic ruleset.
 * @property {boolean} enabled Whether the filter is enabled or
 *   disabled.
 *
 * @typedef {Object} ProcessedFilters
 * @property {Array.<Object>} add Rules to add to the dynamic ruleset
 * @property {Array.<string>} exist Filters that exists.
 * @property {Array.<string>} existOnOtherSubscription Filters that
 *   exist on other subscriptions.
 * @property {Array.<number>} staticRulesToEnable Static rules to enable.
 * @property {Array.<FilterDetails>} details Details of the filters.
 */
/**
 * Process the filter texts.
 *
 * @param {Array.<string>} texts The array of filter texts.
 * @param {?string} subscriptionId The optional subscription ID.
 * @param {?mapper} mapper The DNR mapper for the subscription. If null then
 *   this doesn't check for static rules to enable or disable.
 *
 * @ignore
 * @returns {ProcessedFilters} The processed filters.
 */
async function processFilterTexts(texts, subscriptionId = null, mapper = null) {
  let details = [];
  let add = [];

  // known filter texts that relate to this subscription
  let relateToThisSubscription = [];

  // known filter texts that relate to other subscriptions
  let relateToOtherSubscriptions = [];

  let staticRulesToEnable = [];
  let processedFilterTexts = new Set();

  texts = texts.map(Filter.normalize);
  for (let text of texts) {
    // skip processing possible filter text duplicates
    if (processedFilterTexts.has(text)) {
      continue;
    }

    let filterDetails = dynamicFilters.get(text);
    let filterIsKnown = (filterDetails != null);
    if (filterDetails) {
      let subscriptionIds = filterDetails.subscriptionIds || [null];
      if (subscriptionIds.includes(subscriptionId)) {
        relateToThisSubscription.push(text);
      }
      else {
        relateToOtherSubscriptions.push(text);
      }
    }

    if (mapper) {
      await mapper.load();
      let staticRuleIds = mapper.get(text);
      if (staticRuleIds) {
        staticRulesToEnable.push(...staticRuleIds);
        filterIsKnown = true;
      }
    }

    if (filterIsKnown) {
      continue;
    }

    let filter = Filter.fromText(text);
    let error = validateFilter(filter);
    if (error) {
      throw error;
    }

    if (!filterEngine.filterStorage.filterState.isEnabled(text)) {
      details.push({filter, ruleIds: [], enabled: false});
    }
    else {
      let {filterRules, ruleIds} = await getRules(filter);
      if (filterRules) {
        add.push(...filterRules);
      }
      details.push({filter, ruleIds, enabled: true});
    }

    processedFilterTexts.add(text);
  }

  return {
    add,
    relateToThisSubscription,
    relateToOtherSubscriptions,
    staticRulesToEnable,
    details
  };
}

let TESTING_MAX_DYNAMIC_RULES = 0;

/**
 * For testing purpose, set the a maximum number of dynamic
 * rules. This value is used by `dynamicRulesAvailable()`.
 * @param {number} num The maximum number of dynamic rules. A value of
 *   `0` just unset it and uses the "system" default which is
 *   `browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES`
 *
 * @private
 */
export function testSetDynamicRulesAvailable(num) {
  TESTING_MAX_DYNAMIC_RULES = num;
}

export async function dynamicRulesAvailable() {
  let {declarativeNetRequest} = browser;
  if (!declarativeNetRequest) {
    return Infinity;
  }

  let maxNumberAvailable;
  if (TESTING_MAX_DYNAMIC_RULES > 0) {
    maxNumberAvailable = TESTING_MAX_DYNAMIC_RULES;
  }
  else {
    maxNumberAvailable =
      declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
  }

  let used = (await declarativeNetRequest.getDynamicRules()).length +
               (await declarativeNetRequest.getSessionRules()).length;
  return maxNumberAvailable - used;
}

export async function addFilters(texts, metadata) {
  await init();
  let filters = await processFilterTexts(texts);
  if (filters.relateToThisSubscription.length > 0) {
    throw new FilterError(ERROR_DUPLICATE_FILTERS);
  }

  let {length} = filters.add;
  if (length > 0) {
    // always false when !browser.declarativeNetRequest
    if (length > await dynamicRulesAvailable()) {
      throw new FilterError(ERROR_TOO_MANY_FILTERS);
    }

    // so that this would throw the right error in case
    // browser.declarativeNetRequest doesn't exist or if
    // the API returned a different error instead
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: filters.add
    });
  }

  for (let text of filters.relateToOtherSubscriptions) {
    let filter = dynamicFilters.get(text);
    if (!filter.subscriptionIds) {
      filter.subscriptionIds = [];
    }
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
  if (!details) {
    throw new FilterError(ERROR_FILTER_NOT_FOUND);
  }

  let oldMetadata = details.metadata;
  details.metadata = metadata;
  onChangedFilter.emit({...Filter.fromText(text), metadata, oldMetadata},
                       "metadata");

  storeDynamicFilters();
}

export function getMetadataForFilter(text) {
  let details = dynamicFilters.get(text);
  if (!details) {
    return null;
  }

  let metadata = details.metadata;
  return (typeof metadata != "undefined") ? metadata : null;
}

export async function removeOrDisableFilters(texts, remove = true) {
  await init();

  let filtersToRemove = texts.map(Filter.normalize);
  let ruleIdsToRemove = [];
  for (let text of filtersToRemove) {
    if (!dynamicFilters.has(text)) {
      continue;
    }

    for (let ruleId of dynamicFilters.get(text).ruleIds) {
      ruleIdsToRemove.push(ruleId);
    }

    let details = dynamicFilters.get(text);

    if (remove) {
      // Removing existing filter
      if (details) {
        if (!details.subscriptionIds) {
          details.subscriptionIds = [];
        }

        let index = details.subscriptionIds.indexOf(null);
        if (index !== -1) {
          details.subscriptionIds.splice(index, 1);
        }
      }
      // Removing filter only if subscriptionIds array is empty
      if (details.subscriptionIds && details.subscriptionIds.length == 0) {
        filterEngine.filterStorage.removeFilter(Filter.fromText(text));
        dynamicFilters.delete(text);
      }
      else if (!details.enabled) {
        await enableFilters([text]);
      }
    }
    else {
      // Disabling filter
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

    if (!details || details.enabled) {
      continue;
    }

    let filter = Filter.fromText(normalized);
    filterEngine.filterStorage.filterState.setEnabled(filter.text, true);

    let {filterRules, ruleIds} = await getRules(filter);
    rules.push(...filterRules);

    setHighestRuleId(ruleIds);
    dynamicFilters.set(filter.text, {ruleIds, enabled: true});
  }

  if (rules.length == 0) {
    return;
  }

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
    if (!details.subscriptionIds || details.subscriptionIds.includes(null)) {
      dynamicUserFilters.set(filterText, details);
    }
  }
  return dynamicUserFilters;
}

export async function migrateCustomFilters() {
  let filters = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (!(subscription instanceof SpecialSubscription)) {
      continue;
    }

    for (let text of subscription.filterText()) {
      filters.push({
        text,
        metadata: subscription.metadata,
        disabled: filterEngine.filterStorage.filterState
          .isDisabledForSubscription(text, subscription.url)
      });
    }
  }

  for (let filter of filters) {
    try {
      filterEngine.filterStorage.removeFilter(Filter.fromText(filter.text));
      await addFilters([filter.text], filter.metadata);
      if (filter.disabled) {
        await disableFilter(filter.text);
      }
    }
    catch (e) {
      let errors = Prefs.migration_filter_errors;
      errors.push({error: e.message, filter});
      Prefs.migration_filter_errors = errors;
    }
  }
}
