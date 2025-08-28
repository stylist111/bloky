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

import {getFilterText} from "./subscriptions-utils.js";
import {Filter, InvalidFilter, URLFilter, isActiveFilter}
  from "adblockpluscore/lib/filterClasses.js";
import {SpecialSubscription, DiffUpdatableSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {isValidHostname} from "adblockpluscore/lib/url.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {filterEngine} from "./core.js";
import {createConverter} from "adblockpluscore/lib/dnr/index.js";
import {DnrMapper} from "adblockpluscore/lib/dnr/mapper.js";
import {getSubscriptionRulesetMap} from "./subscriptions-utils.js";
import subscriptions from "./subscriptions.js";
import {onChangedFilter, disableFilter, ERROR_FILTER_NOT_FOUND,
        ERROR_TOO_MANY_FILTERS} from "./filters.js";
import {default as initializer} from "./initializer.js";
import {debug, error} from "./debugging.js";
import {default as sentry} from "./sentry.js";
import {ServerLogger} from "./telemetry/server-logger.js";
import {default as experiments} from "./experiments.js";
import {arraysDiff} from "./set-operations.js";

import {FilterError} from "./types.js";
import {Prefs} from "./prefs.js";
import {isFirefox, getBrowserVersion, isSafari} from "./info.js";

const ERROR_DISABLED_RULE_LIMIT_REACHED = "The number of disabled static " +
      "rules exceeds the disabled rule count limit.";

const serverLogger = new ServerLogger("dnr_filters");

let highestRuleId = 1;

// Filter text to related details (enabled, rule ids, subscription ids, etc) map
const dynamicFiltersMutex = (() => {
  let _dynamicFilters = new Map();

  return {
    async lockRead(callback) {
      return await navigator.locks.request("dynamic_filters", async() => {
        let result = await callback(_dynamicFilters);
        return result;
      });
    },

    async lockWrite(callback) {
      return await navigator.locks.request("dynamic_filters", async() => {
        let result = await callback(_dynamicFilters);
        Prefs.dynamic_filters = Array.from(_dynamicFilters);
        return result;
      });
    },

    async init(dynamicFilterArray) {
      await navigator.locks.request("dynamic_filters", async() => {
        _dynamicFilters = new Map(dynamicFilterArray);
      });
    }
  };
})();

let initializationPromise;

let getRulesFromFilter = () => Promise.resolve([]);
if (browser.declarativeNetRequest) {
  getRulesFromFilter = createConverter({
    async isRegexSupported(regex) {
      let result = await browser.declarativeNetRequest.isRegexSupported(regex);
      return result.isSupported;
    },
    safari: isSafari()
  });
}

export async function disableDynamicRules(subscriptionId) {
  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    let subscriptionDynRules = findDynamicFilters(
      subscriptionId, dynamicFilters
    );
    let {removedDynamicFilters, removeRuleIds} = removeDynamicFilters(
      subscriptionId, [...subscriptionDynRules.keys()], dynamicFilters);
    removedDynamicFilters.forEach(text => dynamicFilters.delete(text));
    await browser.declarativeNetRequest.updateDynamicRules({removeRuleIds});
  });
}

// returns a set of filters (texts) that relate to requested subscription
function findDynamicFilters(subscriptionId, dynamicFilters) {
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

function countRulesToRemove(subscriptionId, filtersToRemove, dynamicFilters) {
  let rulesCount = 0;
  for (let text of filtersToRemove) {
    let detail = dynamicFilters.get(text);
    if (detail && detail.ruleIds && detail.subscriptionIds &&
        detail.subscriptionIds.length == 1 &&
        detail.subscriptionIds[0] == subscriptionId) {
      rulesCount += detail.ruleIds.length;
    }
  }
  return rulesCount;
}

/**
 * Remove the dynamic filters for a subscription.
 *
 * @param {String} subscriptionId The subscription id.
 * @param {Array<String>} filters The filter text array to remove.
 * @param {Array.<FilterDetails>} dynamicFilters The dynamic filters to modify.
 *
 * @return {Object} The rules that were removed.
 *
 * @private
 */
function removeDynamicFilters(subscriptionId, filters, dynamicFilters) {
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
 * Update a DNR subscription using full update mechanism (similar to MV2).
 *
 * @param {Subscription} subscription The subscription updated.
 * @param {?object} lines The most recent filter text.
 *
 * @private
 */
async function dnrFullSubscriptionUpdate(subscription, lines) {
  debug("Full update started");

  lines.shift();

  let filterText = [];
  for (let line of lines) {
    line = Filter.normalize(line);
    if (line) {
      filterText.push(line);
    }
  }

  try {
    await _dnrFullSubscriptionUpdate(subscription, filterText);
  }
  catch (e) {
    error(`Failed to full update: ${e.message}`);
    if (e.type === ERROR_TOO_MANY_FILTERS) {
      subscription.downloadStatus = "synchronize_too_many_filters";
      e.rulesAvailable = await dynamicRulesAvailable();
    }
    else {
      sentry.reportError(e);
      subscription.downloadStatus = "synchronize_dnr_error";
    }
  }
  finally {
    debug("Full update finished");
  }
}

/**
 * Update a DNR subscription using diff mechanism.
 *
 * @param {Subscription} subscription The subscription updated.
 * @param {?object} updates The list of added and removed filter text. If
 *   falsey then nothing happens.
 *
 * @private
 */
export async function dnrDiffSubscriptionUpdate(subscription, updates) {
  debug("Diff update started");
  if (isDnrSubscriptionUpdating(subscription.url)) {
    debug(`Already updating ${subscription.url}, skipping`);
    return;
  }
  dnrSubscriptionUpdating.add(subscription.url);

  try {
    await _dnrDiffSubscriptionUpdate(subscription, updates);
  }
  catch (e) {
    error(`Failed to diff update: ${e.message}`);
    if (e.type === ERROR_TOO_MANY_FILTERS){
      subscription.downloadStatus = "synchronize_diff_too_many_filters";
      e.rulesAvailable = await dynamicRulesAvailable();
    }
    else {
      sentry.reportError(e);
      subscription.downloadStatus = "synchronize_diff_error";
    }
  }
  finally {
    dnrSubscriptionUpdating.delete(subscription.url);
    debug("Diff update finished");
  }
}

export async function removeSubscriptionsDynamicFilters() {
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof DiffUpdatableSubscription) {
      await disableDynamicRules(subscription.id);
    }
  }
}

export async function enableAllDisabledStaticRules() {
  let disableRuleIds = [];
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (!subscription.hasBundledFilters || !subscription.id) {
      continue;
    }

    if (!isSafari()) {
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
    else {
      // eslint-disable-next-line no-console
      console.log("Skipping enabling all static rules on Safari");
    }
  }
}

async function _dnrFullSubscriptionUpdate(subscription, filterText) {
  // With some path of code the filter engine might not be initialized
  // if the service worker got awaken.
  await initializer.start();

  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    // On Safari there is an issue:
    // DNR rule ids overlap with existing dynamic rules (racing?).  So
    // increasing the highest rule id according to actual dynamic rules helps.
    if (isSafari()) {
      let dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
      setHighestRuleId(dynamicRules.map(rule => rule.id));
    }

    let plannedChanges = await processFilterTexts(
      filterText, dynamicFilters, subscription.url
    );

    // All the dynamic filters for this subscription must be removed.
    // User subscriptions don't have an ID, using URL instead
    let knownDynamicFilters = findDynamicFilters(
      subscription.url, dynamicFilters
    );

    if (knownDynamicFilters.size != 0) {
      plannedChanges.relateToThisSubscription.forEach(
        text => knownDynamicFilters.delete(text));

      plannedChanges.relateToOtherSubscriptions.forEach(
        text => knownDynamicFilters.delete(text));
    }

    let dynamicFiltersToRemove = [...knownDynamicFilters.keys()];

    let removeRulesCount = countRulesToRemove(
      subscription.url, dynamicFiltersToRemove, dynamicFilters
    );
    if (plannedChanges.add.length - removeRulesCount >
      await dynamicRulesAvailable()) {
      throw new FilterError(ERROR_TOO_MANY_FILTERS);
    }

    // Adding subscription.id into existing filter
    for (let text of plannedChanges.relateToOtherSubscriptions) {
      let filter = dynamicFilters.get(text);
      filter.subscriptionIds.push(subscription.url);
    }

    // Removing subscription.id from existing filters that are removed.
    let {removeRuleIds} = removeDynamicFilters(
      subscription.url, dynamicFiltersToRemove, dynamicFilters
    );

    let subscriptionActive = (await subscriptions.has(subscription.url)) &&
      !subscription.disabled;
    let addRules = subscriptionActive ? plannedChanges.add : void 0;
    await browser.declarativeNetRequest.updateDynamicRules(
      {addRules, removeRuleIds}
    );

    if (subscriptionActive) {
      plannedChanges.details.forEach(details => {
        let {useFilterEngine, filter, ruleIds, enabled} = details;

        setHighestRuleId(ruleIds);
        dynamicFilters.set(filter.text,
                           {
                             ruleIds, useFilterEngine, enabled, metadata: {},
                             subscriptionIds: [subscription.url]
                           });
      });
    }
  });

  let update = subscription.updateFilterText(filterText);
  filterNotifier.emit(
    "subscription.updated",
    subscription,
    update
  );
}

async function _dnrDiffSubscriptionUpdate(subscription, updates) {
  if (!browser.declarativeNetRequest || !updates) {
    return;
  }

  // For now we only want to handle subscriptions that are in the
  // recommendations.
  if (!subscription.type) {
    return;
  }

  // Determine if we need to update static rules.
  let needUpdateStaticRules = !subscription.downloadable;

  let {added, removed} = updates;

  // With some path of code the filter engine might not be initialized
  // if the service worker got awaken.
  await initializer.start();

  let filterTextToRuleIdsMapper = null; // to static rules ids

  // The already disabled static rules ids.
  let disabledStaticRulesIds = null;

  // This will contain the text of all the dynamic filters for the subscription
  // and it will be updated to remove those that are still here.
  let knownDynamicFilters = new Set();

  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    if (needUpdateStaticRules) {
      filterTextToRuleIdsMapper = new DnrMapper(
        async() => await getSubscriptionRulesetMap(subscription.id)
      );
      disabledStaticRulesIds = isSafari() ? [] :
        await browser.declarativeNetRequest.getDisabledRuleIds({
          rulesetId: subscription.id
        });

      // All the dynamic filters for this subscription must be removed.
      knownDynamicFilters = findDynamicFilters(subscription.id, dynamicFilters);
    }

    let plannedChanges = await processFilterTexts(
      added, dynamicFilters, subscription.id, filterTextToRuleIdsMapper);

    if (knownDynamicFilters.size != 0) {
      plannedChanges.relateToThisSubscription.forEach(
        text => knownDynamicFilters.delete(text));

      plannedChanges.relateToOtherSubscriptions.forEach(
        text => knownDynamicFilters.delete(text));
    }

    // A union of what is explicitly listed in `removed`
    // and dynamic filters that we had for this subscription previously
    // and not listed in `added` anymore
    let dynamicFiltersToRemove = removed.concat(...knownDynamicFilters.keys());

    let removeRulesCount = countRulesToRemove(
      subscription.url, dynamicFiltersToRemove, dynamicFilters
    );

    if (plannedChanges.add.length - removeRulesCount >
      await dynamicRulesAvailable()) {
      throw new FilterError(ERROR_TOO_MANY_FILTERS);
    }

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

      let enableRuleIds = [...plannedChanges.staticRulesToEnable];
      // Reenable the disabled rules to reset the state:
      // `browser.declarativeNetRequest.updateStaticRules` will handle this
      // properly.
      enableRuleIds.push(...disabledStaticRulesIds);

      try {
        if (!isSafari()) {
          await browser.declarativeNetRequest.updateStaticRules({
            rulesetId: subscription.id,
            disableRuleIds,
            enableRuleIds
          });
        }
        else {
          // eslint-disable-next-line no-console
          console.log("Skipping updating static rules on Safari");
        }
      }
      catch (e) {
        if (e.message == ERROR_DISABLED_RULE_LIMIT_REACHED) {
          // This check is based on the error message because there doesn't
          // currently seem to be another appropriate field it identify this
          // case.
          throw new FilterError(ERROR_TOO_MANY_FILTERS);
        }
        throw e;
      }
    }

    // Adding subscription.id into existing filter
    for (let text of plannedChanges.relateToOtherSubscriptions) {
      let filter = dynamicFilters.get(text);
      filter.subscriptionIds.push(subscription.id);
    }

    // Removing subscription.id from existing filters that are removed.
    let {removedDynamicFilters, removeRuleIds} = removeDynamicFilters(
      subscription.id, dynamicFiltersToRemove, dynamicFilters
    );

    // Empty array cause exceptions. Make it `undefined`.
    if (removeRuleIds.length == 0) {
      removeRuleIds = void 0;
    }

    let subscriptionActive = (await subscriptions.has(subscription.url)) &&
      !subscription.disabled;
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: subscriptionActive ? plannedChanges.add : void 0,
      removeRuleIds
    });

    removedDynamicFilters.forEach(text => dynamicFilters.delete(text));

    if (subscriptionActive) {
      plannedChanges.details.forEach(details => {
        let {useFilterEngine, filter, ruleIds, enabled} = details;

        setHighestRuleId(ruleIds);
        dynamicFilters.set(filter.text,
                           {
                             ruleIds, useFilterEngine, enabled, metadata: {},
                             subscriptionIds: [subscription.id]
                           });
      });
    }
  });

  await applyFilterTextUpdate(subscription, updates);
}

/**
 * Apply the filter text update to the subscription.
 *
 * @param {object} subscription The subscription to apply the update to
 * @param {FilterDiffs} updates The update to apply.
 */
async function applyFilterTextUpdate(subscription, updates) {
  let {filterText} = await getFilterText(subscription);

  for (let removeText of updates.removed) {
    let index = filterText.indexOf(removeText);
    if (index >= 0) {
      filterText.splice(index, 1);
    }
  }

  for (let addText of updates.added) {
    filterText.push(addText);
  }

  let storageUpdate = subscription.updateFilterText(filterText);
  filterNotifier.emit("subscription.updated", subscription, storageUpdate);
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

  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    dynamicFilters.clear();

    let rules = await browser.declarativeNetRequest.getDynamicRules();
    if (rules.length == 0) {
      return;
    }

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map(r => r.id)
    });
  });
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

export function clearRulesetUpdates() {
  // This isn't used anymore. It can be cleared out to save storage.
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
        await dynamicFiltersMutex.init(dynamicFilterArray);
      }
      else {
        // DNR rules persist after the extension is uninstalled. The same cannot
        // be said for storage. To be safe, if we have no record of dynamic
        // filters let's clear any DNR rules too.
        await removeAllDynamicFilters();
      }

      filterNotifier.on("subscription.diffReceived", dnrDiffSubscriptionUpdate);
      filterNotifier.on("subscription.fullUpdateReceived", dnrFullSubscriptionUpdate);

      let checkResult = await dynamicFiltersMutex.lockRead(dynamicFilters => {
        for (let {ruleIds} of dynamicFilters.values()) {
          setHighestRuleId(ruleIds);
        }

        return dataIntegrityCheck(dynamicFilters);
      });

      if (checkResult.valid == false) {
        if (await experiments.getFlag("dnr-filters-recreate-dnr-rules-on-integrity-check-failure")) {
          await recreateAllDNRRules();
        }
        else {
          setHighestRuleId([checkResult.highestDNRRuleId]);
        }
      }
    })();
  }

  return initializationPromise;
}

async function dataIntegrityCheck(dynamicFilters) {
  let expectedDynamicRuleIds = Array.from(
    dynamicFilters.values()
      .flatMap(filter => filter.ruleIds ? filter.ruleIds : [])
  );

  let dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
  let actualDynamicRuleIds = dynamicRules.map(rule => rule.id);

  let {added, removed} = arraysDiff(
    expectedDynamicRuleIds,
    actualDynamicRuleIds
  );

  if (added.length > 0 || removed.length > 0) {
    serverLogger.debug("data_integrity_check_failed", {
      extraRulesInDNR: added.length,
      missingRulesInDNR: removed.length
    });
    return {
      valid: false,
      highestDNRRuleId: actualDynamicRuleIds
        .reduce((acc, next) => Math.max(acc, next), 0)
    };
  }

  return {valid: true};
}

async function recreateAllDNRRules() {
  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    highestRuleId = 1;

    let recreatedRules = [];
    for (let filter of dynamicFilters.values()) {
      if (!filter.enabled) {
        continue;
      }

      let {filterRules, ruleIds} = await getRules(filter.filter);
      if (filterRules) {
        recreatedRules.push(...filterRules);
      }
      filter.ruleIds = ruleIds;
    }

    let currentDynamicRules =
        await browser.declarativeNetRequest.getDynamicRules();

    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: recreatedRules,
      removeRuleIds: currentDynamicRules.map(r => r.id)
    });
  });
}

async function getRules(filter) {
  let ruleIds = [];
  let filterRules = [];

  // "sitekey" option is not supported in DNR
  if (filter instanceof URLFilter && !filter.sitekeys) {
    let result = await getRulesFromFilter(filter.text);
    if (result.name == "Error") {
      let {option} = result.detail;
      throw new FilterError("invalid_filter", result.message, option);
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
 * @property {Array.<Error>} invalid Invalid filters
 * @property {Array.<string>} relateToThisSubscription Filters that exists.
 * @property {Array.<string>} relateToOtherSubscriptions Filters that
 *   exist on other subscriptions.
 * @property {Array.<number>} staticRulesToEnable Static rules to enable.
 * @property {Array.<FilterDetails>} details Details of the filters.
 */
/**
 * Process the filter texts.
 *
 * @param {Array.<string>} texts The array of filter texts.
 * @param {Array.<FilterDetails>} dynamicFilters The existing dynamic filters in
 *   the system.
 * @param {?string} subscriptionId The optional subscription ID.
 * @param {?mapper} mapper The DNR mapper for the subscription. If null then
 *   this doesn't check for static rules to enable or disable.
 * @param {?boolean} filtersWillBeEnabled Some filters are prepared differently
 * if they are disabled according to the filterState, for example not generating
 * DNR rules. If this is true, then the filters are going to be enabled as part
 * of adding them, and so checking the filterState should be skipped.
 *
 * @ignore
 * @returns {Promise<ProcessedFilters>} The processed filters.
 */
async function processFilterTexts(texts, dynamicFilters, subscriptionId = null,
                                  mapper = null, filtersWillBeEnabled = false) {
  let details = [];
  let add = [];
  let invalid = [];

  // known filter texts that relate to this subscription
  let relateToThisSubscription = [];

  // known filter texts that relate to other subscriptions
  let relateToOtherSubscriptions = [];

  let staticRulesToEnable = [];
  let processedFilterTexts = new Set();

  texts = texts.map(text => Filter.normalize(text));
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
    let filterError = validateFilter(filter);
    if (filterError) {
      invalid.push(filterError);
      continue;
    }

    if (!filtersWillBeEnabled &&
        !filterEngine.filterStorage.filterState.isEnabled(text)) {
      details.push({filter, ruleIds: [], enabled: false});
    }
    else {
      try {
        let {filterRules, ruleIds} = await getRules(filter);
        if (filterRules) {
          add.push(...filterRules);
        }
        details.push({filter, ruleIds, enabled: true});
      }
      catch (e) {
        invalid.push(e);
      }
    }

    processedFilterTexts.add(text);
  }

  return {
    add,
    invalid,
    relateToThisSubscription,
    relateToOtherSubscriptions,
    staticRulesToEnable,
    details
  };
}

const RULES_LIMIT_KEY = "EWE:Dynamic_Rules_Limit";

/**
 * For testing purpose, set the a maximum number of dynamic
 * rules. This value is used by `dynamicRulesAvailable()`.
 * @param {number} num The maximum number of dynamic rules. A value of
 *   `0` just unset it and uses the "system" default which is
 *   `browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES`
 *   on Chromium < 121/Firefox or
 *   `browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES`
 *   on more recent versions.
 *
 * @private
 */
export async function testSetDynamicRulesAvailable(num) {
  await browser.storage.session.set({[RULES_LIMIT_KEY]: num});
}

export async function dynamicRulesAvailable() {
  let {declarativeNetRequest} = browser;
  if (!declarativeNetRequest) {
    return Infinity;
  }

  let overriddenMaxRules = await browser.storage.session.get(RULES_LIMIT_KEY);
  let maxRules = overriddenMaxRules[RULES_LIMIT_KEY] > 0 ?
      overriddenMaxRules[RULES_LIMIT_KEY] :
      isFirefox() ?
        declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES :
        isSafari() || getBrowserVersion()[0] < 121 ? // Chromium or edge: EE-315
          declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES :
          declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES;

  let used = (await declarativeNetRequest.getDynamicRules()).length +
      (await declarativeNetRequest.getSessionRules()).length;
  return maxRules - used;
}

export async function addFilters(texts, metadata) {
  await init();

  return await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    let plannedChanges = await processFilterTexts(
      texts, dynamicFilters, null, null, true
    );
    if (plannedChanges.invalid.length > 0) {
      throw plannedChanges.invalid[0];
    }

    if (plannedChanges.add.length > 0) {
      // always false when !browser.declarativeNetRequest
      if (plannedChanges.add.length > await dynamicRulesAvailable()) {
        throw new FilterError(ERROR_TOO_MANY_FILTERS);
      }

      // so that this would throw the right error in case
      // browser.declarativeNetRequest doesn't exist or if
      // the API returned a different error instead
      await browser.declarativeNetRequest.updateDynamicRules({
        addRules: plannedChanges.add
      });
    }

    let subscription;
    for (let text of plannedChanges.relateToOtherSubscriptions) {
      subscription = await filterEngine.filterStorage.addFilter(
        Filter.fromText(text),
        subscription
      );

      let detail = dynamicFilters.get(text);
      if (!detail.subscriptionIds) {
        detail.subscriptionIds = [];
      }
      detail.subscriptionIds.push(null);
    }

    for (let filterDetails of plannedChanges.details) {
      let {filter, ruleIds, enabled} = filterDetails;
      subscription = await filterEngine.filterStorage
        .addFilter(filter, subscription);


      setHighestRuleId(ruleIds);
      dynamicFilters.set(filter.text, {
        ruleIds, enabled, metadata,
        subscriptionIds: [null]
      });
    }

    return {
      added: plannedChanges.details.map(detail => detail.filter.text)
        .concat(plannedChanges.relateToOtherSubscriptions),
      exists: plannedChanges.relateToThisSubscription
    };
  });
}

export async function setMetadataForFilter(text, metadata) {
  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    let details = dynamicFilters.get(text);
    if (!details) {
      throw new FilterError(ERROR_FILTER_NOT_FOUND);
    }

    let oldMetadata = details.metadata;
    details.metadata = metadata;
    onChangedFilter.emit({...Filter.fromText(text), metadata, oldMetadata},
                         "metadata");
  });
}

export async function getMetadataForFilter(text) {
  return await dynamicFiltersMutex.lockRead(async dynamicFilters => {
    let details = dynamicFilters.get(text);
    if (!details) {
      return null;
    }

    let metadata = details.metadata;
    return (typeof metadata != "undefined") ? metadata : null;
  });
}

export async function removeOrDisableFilters(filterTexts, remove = true) {
  await init();

  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    let {dynamicFilterTexts} = splitFilterTexts(filterTexts, dynamicFilters);

    await removeOrDisableDynamicFilters(
      dynamicFilterTexts, dynamicFilters, remove
    );
    // It can happen that user filter duplicates existing filter from
    // static ruleset.
    // If we need to disable the filter, then we should
    // also disable the static rule.
    // If we need to remove the dynamic filter, then we should
    // enable the according static rule just like user filter never
    // existed.
    await enableStaticRules(filterTexts, remove);
  });
}

async function enableStaticRules(filterTexts, enable) {
  let dnrMappers = new Map();
  let rulesetIdToRuleIds = new Map();

  // map filter text to (rulesetId => list(ruleIds)) map
  for (let filterText of filterTexts) {
    for (let subscription of
      filterEngine.filterStorage.subscriptions(filterText)) {
      if (subscription instanceof SpecialSubscription ||
        !subscription.id) {
        continue;
      }

      let dnrMapperForThisSubscription = dnrMappers.get(subscription.id);
      if (!dnrMapperForThisSubscription) {
        dnrMapperForThisSubscription = new DnrMapper(
          async() => await getSubscriptionRulesetMap(subscription.id));
        await dnrMapperForThisSubscription.load();
        dnrMappers.set(subscription.id, dnrMapperForThisSubscription);
      }

      try {
        let ruleIds = dnrMapperForThisSubscription.get(filterText);
        if (ruleIds && ruleIds.length) {
          rulesetIdToRuleIds.set(subscription.id, ruleIds);
        }
      }
      catch (e) {
        // mapping file might be missing
      }
    }
  }

  // disable the rules in static rulesets
  for (const [rulesetId, ruleIds] of rulesetIdToRuleIds.entries()) {
    let disableRuleIds = (enable ? void 0 : ruleIds);
    let enableRuleIds = (enable ? ruleIds : void 0);

    if (!isSafari()) {
      await browser.declarativeNetRequest.updateStaticRules({
        rulesetId, disableRuleIds, enableRuleIds
      });
    }
    else {
      // eslint-disable-next-line no-console
      console.log("Skipping updating static rules on Safari");
    }
  }
}

async function removeOrDisableDynamicFilters(filterTexts, dynamicFilters,
                                             remove = true) {
  let ruleIdsToRemove = [];

  for (let text of filterTexts) {
    let details = dynamicFilters.get(text);

    if (remove) {
      // Removing existing filter
      filterEngine.filterStorage.removeFilter(Filter.fromText(text));

      if (details) {
        if (!details.subscriptionIds) {
          details.subscriptionIds = [];
        }

        let index = details.subscriptionIds.indexOf(null);
        if (index !== -1) {
          details.subscriptionIds.splice(index, 1);
        }

        // Removing filter only if subscriptionIds array is empty
        if (details.subscriptionIds && details.subscriptionIds.length == 0) {
          for (let ruleId of details.ruleIds) {
            ruleIdsToRemove.push(ruleId);
          }

          dynamicFilters.delete(text);
        }
        else if (!details.enabled) {
          // Disabling filters is something we do to user filters, not filters
          // in subscriptions. If the disabled user filter is removed, but it
          // still exists in a subscription, then the subscription one needs to
          // be reenabled.
          await _enableFilters([text], dynamicFilters);
        }
      }
    }
    else {
      for (let ruleId of details.ruleIds) {
        ruleIdsToRemove.push(ruleId);
      }

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
}

async function enableDynamicFilters(filterTexts, dynamicFilters) {
  let rules = [];

  for (let text of filterTexts) {
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
}

function splitFilterTexts(filterTexts, dynamicFilters) {
  let dynamicFilterTexts = [];
  let staticFilterTexts = [];

  let normalizedFilterTexts = filterTexts.map(text => Filter.normalize(text));
  for (let filterText of normalizedFilterTexts) {
    if (dynamicFilters.has(filterText)) {
      dynamicFilterTexts.push(filterText);
    }
    else {
      staticFilterTexts.push(filterText);
    }
  }

  return {dynamicFilterTexts, staticFilterTexts};
}

async function _enableFilters(filterTexts, dynamicFilters) {
  let {dynamicFilterTexts, staticFilterTexts} =
      splitFilterTexts(filterTexts, dynamicFilters);

  await enableDynamicFilters(dynamicFilterTexts, dynamicFilters);
  await enableStaticRules(staticFilterTexts, true);
}

export async function enableFilters(filterTexts) {
  await init();

  await dynamicFiltersMutex.lockWrite(async dynamicFilters => {
    await _enableFilters(filterTexts, dynamicFilters);
  });
}

export async function getDynamicFilters() {
  await init();
  return await dynamicFiltersMutex.lockRead(dynamicFilters => {
    return dynamicFilters;
  });
}

export async function getDynamicUserFilters() {
  await init();

  return await dynamicFiltersMutex.lockRead(async dynamicFilters => {
    let dynamicUserFilters = new Map();

    for (let [filterText, details] of dynamicFilters.entries()) {
      if (!details.subscriptionIds || details.subscriptionIds.includes(null)) {
        dynamicUserFilters.set(filterText, details);
      }
    }
    return dynamicUserFilters;
  });
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
      sentry.reportError(e);
      let errors = Prefs.migration_filter_errors;

      if (!Array.isArray(errors)) {
        errors = [];
      }

      errors.push({error: e.message, filter});
      Prefs.migration_filter_errors = errors;
    }
  }
}
