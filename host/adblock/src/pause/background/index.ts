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

import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { FilterOrigin } from "../../filters/shared";
import { createFilterMetaData } from "~/utilities/background/bg-functions";
import { Prefs } from "~/alias/prefs";
import { initialize } from "~/alias/subscriptionInit";

const pausedKey = "paused";
// white-list all blocking requests regardless of frame / document, but still allows element hiding
const pausedFilterText1 = "@@*";
// white-list all documents, which prevents element hiding
const pausedFilterText2 = "@@*$document";

const createDomainAllowlistRule = function (domain: string): string {
  return `@@||${domain}^$document`;
};

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
const adblockIsPaused = async function (newValue?: boolean): Promise<boolean | undefined> {
  if (newValue === undefined) {
    const response = await browser.storage.local.get(pausedKey);
    return response[pausedKey] === true;
  }

  if (newValue) {
    await browser.storage.local.set({ [pausedKey]: true });
    await ewe.filters.add([pausedFilterText1, pausedFilterText2]);
  } else {
    await ewe.filters.remove([pausedFilterText1, pausedFilterText2]);
    await browser.storage.local.remove(pausedKey);
  }
  return undefined;
};

/**
 * Adds an allowlist rule for the specified URL
 * @param {string} origin - a String representing the method that
 *                 user or event that added the filter rule
 */
const allowlistTab = async (tabURL: string, origin = FilterOrigin.popup): Promise<void> => {
  const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
  const metadata = {
    ...createFilterMetaData(origin),
    expiresAt: Date.now() + autoExtendMs,
    autoExtendMs,
  };

  const url = new URL(tabURL);
  const host = url.hostname.replace(/^www\./, "");
  await ewe.filters.add(createDomainAllowlistRule(host), metadata);
};

/**
 * Removes all allowlist rules for the specified tab
 * @param {number} tabId - the id of the tab that should have all
 *                         allowing filters removed
 * @return {boolean} true, if the rule(s) were removed
 *                   false, if no allowlist rules were found
 */
const removeAllAllowlistRulesForTab = async (tabId: number): Promise<boolean> => {
  const filters = await ewe.filters.getAllowingFilters(tabId);
  await ewe.filters.remove(filters);
  return filters.length > 0;
};

/**
 * Determines if the tab temporarily allowlisted
 * @param {number} tabId - the id of the tab that should have all
 *                         allowing filters removed
 * @return {boolean} true, if the  tab is temporarily allowlisted
 *                   false, if the tab is not temporarily allowlisted
 */
const isTabTemporaryAllowlisted = async (tabId: number): Promise<boolean> => {
  const filters = await ewe.filters.getAllowingFilters(tabId);
  let metaDataMatch = false;
  for (let i = 0; i < filters.length && !metaDataMatch; i++) {
    const metadata = await ewe.filters.getMetadata(filters[i]);
    metaDataMatch = metadata?.expiresByTabId === tabId;
  }
  return metaDataMatch;
};

// If AdBlock was paused on shutdown , then
// unpause / remove the global allow-list rules at startup.
async function start(): Promise<void> {
  const response = await browser.storage.local.get(pausedKey);
  if (response[pausedKey]) {
    await initialize.then();
    await ewe.filters.remove([pausedFilterText1, pausedFilterText2]);
    await browser.storage.local.remove(pausedKey);
  }
}

function handleExtensionStartup(): void {
  void start();
}
browser.runtime.onStartup.addListener(handleExtensionStartup);

export {
  allowlistTab,
  isTabTemporaryAllowlisted,
  removeAllAllowlistRulesForTab,
  adblockIsPaused,
  pausedFilterText1,
  pausedFilterText2,
};
