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

import {subscriptionFileExists, rulesetExistsInManifest}
  from "./subscriptions-utils.js";

export async function validate(bundledSubscriptions,
                               bundledSubscriptionsPath) {
  let warnings = [];

  for (let subscription of bundledSubscriptions) {
    let fileExists = await subscriptionFileExists(
      subscription, bundledSubscriptionsPath);
    if (!fileExists) {
      warnings.push(`No subscription content file for ID=${subscription.id}`);
    }

    if (!rulesetExistsInManifest(subscription.id)) {
      warnings.push(`No ruleset with ID=${subscription.id} declared in the manifest`);
    }
  }

  return warnings;
}
