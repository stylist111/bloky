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

import ServerMessages from "~/servermessages";
import { getAAStatus } from "~/telemetry/background";
import { type TabPage } from "../../core/pages/background";

/**
 * Records metrics related to pageviews for specific domains
 *
 * @param page - Page
 */
async function handlePageLoaded(page: TabPage): Promise<void> {
  if (typeof page.id === "undefined" || page.id === browser.tabs.TAB_ID_NONE) {
    return;
  }

  const domains = await ewe.experiments.getFlag("pageview-metrics:domains");
  if (!isStringArray(domains) || !domains.length) {
    return;
  }

  if (!domains.includes(getBaseDomain(page.url.hostname))) {
    return;
  }

  let pageState = 0;
  pageState |= (await isTabAllowlisted(page.id)) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await isTabPrivate(page.id)) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await isAcceptableAdsEnabled()) ? 1 : 0;

  ServerMessages.recordAnonymousMessage("pageview", "stats", null, {
    var: pageState,
  });
}

/**
 * Determines whether Acceptable Ads is enabled
 *
 * @returns whether Acceptable Ads is enabled
 */
async function isAcceptableAdsEnabled(): Promise<boolean> {
  const status = await getAAStatus();
  return status === "1" || status === "2";
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

/**
 * Determines whether the given tab is in a private window
 *
 * @returns whether the given tab is in a private window
 */
async function isTabPrivate(tabId: number): Promise<boolean> {
  const tab = await browser.tabs.get(tabId);
  return tab.incognito;
}

/**
 * Determines whether the given tab is allowlisted
 *
 * @param tabId - Tab ID
 *
 * @returns whether the given tab is allowlisted
 */
async function isTabAllowlisted(tabId: number): Promise<boolean> {
  const allowingFilters = await ewe.filters.getAllowingFilters(tabId);
  return allowingFilters.length > 0;
}

/**
 * Initializes page view metrics functionality.
 */
export function start(): void {
  ext.pages.onLoaded.addListener(handlePageLoaded);
}
