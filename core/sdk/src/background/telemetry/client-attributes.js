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

import {getAllFacts} from "../remote-config/storage.js";

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
      value: String(facts.installDate),
    });
  }
  if (facts.filterLists != null) {
    clientAttributes.push({key: "filter_lists", values: facts.filterLists});
  }
  if (facts.customFiltersCount != null) {
    clientAttributes.push({
      key: "custom_filters_count",
      value: String(facts.customFiltersCount),
    });
  }
  if (facts.dynamicRuleCount != null) {
    clientAttributes.push({
      key: "dynamic_rule_count",
      value: String(facts.dynamicRuleCount),
    });
  }
  if (facts.staticRuleCount != null) {
    clientAttributes.push({
      key: "static_rule_count",
      value: String(facts.staticRuleCount),
    });
  }

  if (facts.pingIdMintCount != null) {
    clientAttributes.push({
      key: "ping_id_mint_count",
      value: String(facts.pingIdMintCount),
    });
  }
  if (facts.eventsIdMintCount != null) {
    clientAttributes.push({
      key: "events_id_mint_count",
      value: String(facts.eventsIdMintCount),
    });
  }

  if (facts.clientIdRotationFrequency) {
    clientAttributes.push({
      key: "client_id_rotation_frequency",
      value: String(facts.clientIdRotationFrequency),
    });
  }

  return clientAttributes;
}
