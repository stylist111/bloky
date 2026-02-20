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
import type { Facts } from "@eyeo/webext-ad-filtering-solution";

/**
 * Returns the facts to be used in cohorts and experiments definition
 *
 * @returns {Promise<Facts>}
 */
export async function getFacts(): Promise<Facts> {
  await Promise.all([Prefs.untilLoaded, License.ready()]);

  return {
    hasPremium: await License.isActiveLicense(),
    installDate: Prefs.get("installDate"),
    blockedCount: Prefs.get("blocked_total"),
  };
}
