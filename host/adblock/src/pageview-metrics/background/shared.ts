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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { getBaseDomain } from "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/url";
import { Prefs } from "~/alias/prefs";

/**
 * Determines whether metrics should be recorded for given domain.
 *
 * @param domain - Domain
 * @returns base domain for which metrics should be recorded
 *   (or null, if no metrics should be recorded for the given domain)
 */
export async function getMatchingDomain(domain: string | null): Promise<string | null> {
  if (!domain) {
    return null;
  }

  const domains = await ewe.experiments.getFlag("pageview-metrics:domains");
  if (!isStringArray(domains) || !domains.length) {
    return null;
  }

  const baseDomain = getBaseDomain(domain);
  if (!domains.includes(baseDomain)) {
    return null;
  }

  return baseDomain;
}

/**
 * Determines if ubo was detected in the last 7 days.
 *
 * @returns whether ubo was detected in the last 7 days
 */
export async function hasUbo(): Promise<boolean> {
  await Prefs.untilLoaded;
  // Was detected in the last 7 days
  return Date.now() - Prefs.get("uboDetected") < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Determines if ubo detection was active in the last 7 days.
 *
 * @returns whether ubo detection was active in the last 7 days
 */
export async function uboDetectionWasActive(): Promise<boolean> {
  await Prefs.untilLoaded;
  // Was run in the last 7 days
  return Date.now() - Prefs.get("uboDetectionLastRun") < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Determines whether given candidate is a string array
 *
 * @param candidate
 *
 * @returns whether given candidate is a string array
 */
function isStringArray(candidate: unknown): candidate is string[] {
  return Array.isArray(candidate) && (!candidate.length || typeof candidate[0] === "string");
}
