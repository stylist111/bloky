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

import browser from "../browser.js";
import {truncateTimestampToDayStart} from "#adblockpluscore/lib/time.js";
import {sha256Prefix} from "../../all/hashing.js";
import {getAllFacts} from "../remote-config/storage.js";
import {TRACKED_URLS, toTrackedFilterListUrl}
  from "../remote-config/filter-list-urls.js";
import sentry from "../sentry.js";
import {STATES, getEntries as getLedgerEntries}
  from "../subscription-ledger.js";
import {sumRuleCounts} from "../subscriptions-utils.js";

/**
 * Rounds a value to a single significant figure.
 *
 * For example, 5 stays 5, 53 rounds to 50, 753 rounds to 800.
 *
 * This allows bucketing values of varying orders of magnitude without needing
 * to specify the size of the buckets up front.
 *
 * @param {number} x - An unrounded number
 * @returns {number} The rounded value
 */
function roundSig1(x) {
  return Number(x.toPrecision(1));
}

/**
 * Picks which of two ledger entries recorded for the same tracked filter
 * list represents it. Subscribed entries win over removed ones, otherwise
 * the latest change wins.
 *
 * @param {Object} current - The entry picked so far, if any
 * @param {Object} candidate - Another entry for the same filter list
 * @returns {Object} The entry representing the filter list
 */
function pickLedgerEntry(current, candidate) {
  if (!current) {
    return candidate;
  }
  const currentRemoved = current.state === STATES.REMOVED;
  const candidateRemoved = candidate.state === STATES.REMOVED;
  if (currentRemoved !== candidateRemoved) {
    return currentRemoved ? candidate : current;
  }
  return candidate.ts > current.ts ? candidate : current;
}

/**
 * Builds the subscription ledger values of the filter lists included in
 * telemetry, as `<hash>:<state>:<reason>`, or `<hash>:absent` for the ones
 * that have no ledger entry.
 *
 * @returns {Promise<string[]|undefined>} The sorted values, or undefined if
 *   the ledger couldn't be read.
 */
async function buildFilterListsLedger() {
  let entries;
  try {
    entries = await getLedgerEntries();
  }
  catch (e) {
    sentry.reportError(e);
    return;
  }

  const entriesByTrackedUrl = new Map();
  for (const url of Object.keys(entries).sort()) {
    for (const trackedUrl of toTrackedFilterListUrl(url)) {
      entriesByTrackedUrl.set(
        trackedUrl,
        pickLedgerEntry(entriesByTrackedUrl.get(trackedUrl), entries[url])
      );
    }
  }

  const values = await Promise.all([...TRACKED_URLS].map(async url => {
    const hash = await sha256Prefix(url);
    const entry = entriesByTrackedUrl.get(url);
    return entry ? `${hash}:${entry.state}:${entry.reason}` : `${hash}:absent`;
  }));
  return values.sort();
}

/**
 * Reads the static rule capacity from the browser: how many static rules
 * the extension can still enable, and how many rules the rulesets the
 * browser reports as enabled contain.
 *
 * @returns {Promise<{available: number, enabled: number}|undefined>}
 *   undefined on Manifest V2, or if the browser couldn't be queried or
 *   didn't report a number.
 */
async function getStaticRuleCapacity() {
  if (!browser.declarativeNetRequest) {
    return;
  }
  try {
    const [available, enabledRulesetIds] = await Promise.all([
      browser.declarativeNetRequest.getAvailableStaticRuleCount(),
      browser.declarativeNetRequest.getEnabledRulesets()
    ]);
    if (typeof available != "number") {
      return;
    }
    return {available, enabled: sumRuleCounts(enabledRulesetIds)};
  }
  catch (e) {
    sentry.reportError(e);
  }
}

/**
 * Builds the client_attributes array for ping payloads.
 * @returns {Promise<Array>}
 * @ignore
 */
export async function buildClientAttributes() {
  const facts = await getAllFacts();
  const clientAttributes = [];

  if (facts.installDate) {
    clientAttributes.push({
      key: "install_time",
      value: String(truncateTimestampToDayStart(facts.installDate)),
    });
  }
  if (facts.installType) {
    clientAttributes.push({key: "install_type", value: facts.installType});
  }
  if (facts.filterLists != null) {
    clientAttributes.push({key: "filter_lists", values: facts.filterLists});
  }
  const filterListsLedger = await buildFilterListsLedger();
  if (filterListsLedger) {
    clientAttributes.push({key: "filter_lists_ledger", values: filterListsLedger});
  }
  if (facts.customFiltersCount != null) {
    clientAttributes.push({
      key: "custom_filters_count",
      value: String(roundSig1(facts.customFiltersCount)),
    });
  }
  if (facts.dynamicRuleCount != null) {
    clientAttributes.push({
      key: "dynamic_rule_count",
      value: String(roundSig1(facts.dynamicRuleCount)),
    });
  }
  if (facts.staticRuleCount != null) {
    clientAttributes.push({
      key: "static_rule_count",
      value: String(roundSig1(facts.staticRuleCount)),
    });
  }
  const staticRuleCapacity = await getStaticRuleCapacity();
  if (staticRuleCapacity) {
    clientAttributes.push({
      key: "available_static_rule_count",
      value: String(roundSig1(staticRuleCapacity.available)),
    });
    clientAttributes.push({
      key: "enabled_static_rule_count",
      value: String(roundSig1(staticRuleCapacity.enabled)),
    });
  }

  if (facts.pingIdMintCount != null) {
    clientAttributes.push({
      key: "ping_id_mint_count",
      value: String(roundSig1(facts.pingIdMintCount)),
    });
  }
  if (facts.eventsIdMintCount != null) {
    clientAttributes.push({
      key: "events_id_mint_count",
      value: String(roundSig1(facts.eventsIdMintCount)),
    });
  }

  if (facts.clientIdRotationFrequency) {
    clientAttributes.push({
      key: "client_id_rotation_frequency",
      value: String(roundSig1(facts.clientIdRotationFrequency)),
    });
  }

  return clientAttributes;
}
