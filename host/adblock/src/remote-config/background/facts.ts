/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Prefs } from "~/alias/prefs";
import { License } from "~/picreplacement/check";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import type { Facts } from "@eyeo/webext-ad-filtering-solution";

/**
 * Returns the facts to be used in cohorts and experiments definition
 *
 * @returns {Promise<Facts>}
 */
export async function getFacts(): Promise<Facts> {
  await Promise.all([Prefs.untilLoaded, License.ready()]);
  const userFilters = await ewe.filters.getUserFilters();

  return {
    hasPremium: await License.isActiveLicense(),
    installDate: Prefs.get("installDate"),
    blockedCount: Prefs.get("blocked_total"),
    reverseTrialStartDate: Prefs.get("reverse_trial_start_date"),
    lastBlockthroughTagDate: Prefs.get("lastBlockthroughTagDate"),
    lastBaitBlockedDate: Prefs.get("lastBaitBlockedDate"),
    partnerExtensionCoinstalled:
      (Prefs.get("partnerExtensionFound")?.extesnionsIdsFound?.length ?? 0) > 0,
    customFiltersCount: userFilters.filter((f) => f.enabled === true).length,
  };
}

/**
 * Add listeners to facts which need to be re-evaluated immediately when they
 * change, rather than waiting for the next scheduled sync.
 */
export function start(): void {
  License.licenseNotifier.on("license.status.changed", ewe.remoteConfig.updateFacts);
  Prefs.on("installDate", ewe.remoteConfig.updateFacts);
  ewe.subscriptions.onAdded.addListener(ewe.remoteConfig.updateFacts);
  ewe.subscriptions.onChanged.addListener(async () => {
    await ewe.remoteConfig.updateFacts();
  });
  ewe.subscriptions.onRemoved.addListener(ewe.remoteConfig.updateFacts);
}
