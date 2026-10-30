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

const MV2_BASE = "https://easylist-downloads.adblockplus.org/";
const MV3_BASE = "https://easylist-downloads.adblockplus.org/v3/full/";

export const EASYLIST_MV2 = "https://easylist-downloads.adblockplus.org/easylist.txt";
export const EASYLIST_MV3 = "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt";

const TRACKED_FILENAMES = [
  "easylist.txt",
  "exceptionrules.txt",
  "exceptionrules-privacy-friendly.txt",
  "abp-filters-anti-cv.txt",
  "easyprivacy.txt",
  "adblock_premium.txt"
];

const TRACKED_URLS = new Set(
  TRACKED_FILENAMES.flatMap(f => [MV2_BASE + f, MV3_BASE + f])
);

/**
 * Returns a single-element array with the normalized URL for filter lists
 * that should be included in telemetry, or an empty array for those that
 * should not. Intended for use with flatMap.
 *
 * EasyList+Language variants (e.g. easylistgermany+easylist.txt) are
 * normalized to the base EasyList URL so they are bucketed together.
 *
 * @param {string} url
 * @returns {string[]}
 */
export function toTrackedFilterListUrl(url) {
  if (url.endsWith("+easylist.txt")) {
    if (url.startsWith(MV3_BASE)) {
      return [EASYLIST_MV3];
    }
    if (url.startsWith(MV2_BASE)) {
      return [EASYLIST_MV2];
    }
  }
  return TRACKED_URLS.has(url) ? [url] : [];
}

/**
 * Whether a subscription should count as an active filter list. Bundled
 * (non-downloadable) MV3 lists are active from install, while downloadable
 * lists only have filters after a successful download.
 *
 * @param {Object} subscription
 * @returns {boolean}
 */
export function isActiveFilterList(subscription) {
  return !!subscription.url && subscription.enabled &&
    (!subscription.downloadable || subscription.downloadCount > 0);
}
