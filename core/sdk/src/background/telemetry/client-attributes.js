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

import {truncateTimestampToDayStart} from "#adblockpluscore/lib/time.js";
import {getAllFacts} from "../remote-config/storage.js";

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
  if (facts.filterLists != null) {
    clientAttributes.push({key: "filter_lists", values: facts.filterLists});
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
