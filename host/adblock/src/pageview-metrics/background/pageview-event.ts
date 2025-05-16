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

import ServerMessages from "~/servermessages";
import { getAAStatus } from "~/telemetry/background";
import { type TabPage } from "../../core/pages/background";
import { getMatchingDomain, hasUbo, uboDetectionWasActive } from "./shared";

/**
 * Records metrics related to pageviews for specific domains
 *
 * @param page - Page
 */
async function handlePageLoaded(page: TabPage): Promise<void> {
  if (typeof page.id === "undefined" || page.id === browser.tabs.TAB_ID_NONE) {
    return;
  }

  const domain = await getMatchingDomain(page.url.hostname);
  if (!domain) {
    return;
  }

  let pageState = 0;
  pageState |= (await hasUbo()) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await uboDetectionWasActive()) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await isTabAllowlisted(page.id)) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await isTabPrivate(page.id)) ? 1 : 0;
  pageState <<= 1;
  pageState |= (await isAcceptableAdsEnabled()) ? 1 : 0;

  ServerMessages.recordAnonymousMessage("pageview", "stats", null, {
    misc_text: domain,
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
 * Determines whether the given tab is in a private window
 *
 * @returns whether the given tab is in a private window
 */
async function isTabPrivate(tabId: number): Promise<boolean> {
  const tab = await browser.tabs.get(tabId);
  return tab.incognito;
}

/**
 * Initializes functionality to record pageviews.
 */
export function start(): void {
  ext.pages.onLoaded.addListener(handlePageLoaded);
}
