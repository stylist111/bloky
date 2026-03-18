/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import {
  hasActiveLicense,
  emitter as premiumEventEmitter
} from "~/premium/background";
import type { Facts } from "@eyeo/webext-ad-filtering-solution";

/**
 * Returns the facts to be used in cohorts and experiments definition
 *
 * @returns {Promise<Facts>}
 */
export async function getFacts(): Promise<Facts> {
  await Prefs.untilLoaded;

  return {
    hasPremium: await hasActiveLicense(),
    installDate: Prefs.get("installDate"),
    blockedCount: Prefs.get("blocked_total")
  };
}

/**
 * Add listeners to facts which need to be re-evaluated immediately when they
 * change, rather than waiting for the next scheduled sync.
 */
export function start(): void {
  premiumEventEmitter.on("activated", ewe.remoteConfig.updateFacts);
  premiumEventEmitter.on("deactivated", ewe.remoteConfig.updateFacts);
  Prefs.on("installDate", ewe.remoteConfig.updateFacts);
}
