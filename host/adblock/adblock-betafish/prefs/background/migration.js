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
/* For ESLint: List any global identifiers used in this file below */
/* global browser  */
/**
 * @overview Migrates existing data from older versions
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

async function unsubscribeToFilterList(url) {
  if (await ewe.subscriptions.has(url)) {
    await ewe.subscriptions.remove(url, { reason: ewe.subscriptions.REASONS.MIGRATION });
    return true;
  }
  return false;
}

/**
 * Cleans up any leftover sync data from older versions
 * https://eyeo.atlassian.net/browse/EXT-1078
 * @returns {Promise<void>}
 */
async function cleanUpSyncData() {
  const keysToRemove = [
    "syncPendingPostDataKey",
    "SyncLogMessageKey",
    "SyncCommitKey",
    "SyncPreviousDataKey",
    "SyncExtensionNameKey",
  ];

  try {
    await browser.storage.local.remove(keysToRemove);
  } catch (e) {
    // Silently ignore errors
  }
}

/**
 * Migrates existing user data from older versions
 */
async function migrateUserData() {
  await cleanUpSyncData();
  // We remove the AdBlock Custom filter list,
  // because it no longer serves any purpose
  unsubscribeToFilterList("https://cdn.adblockcdn.com/filters/adblock_custom.txt");

  // Remove any of the old Distraction Control Filters,
  // Subscript to the new DC filter list
  const DISTRACTION_CONTROL_URL_LIST = [
    "https://easylist-downloads.adblockplus.org/v3/full/distraction-control-newsletter.txt",
    "https://cdn.adblockcdn.com/filters/distraction-control-newsletter.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/distraction-control-push.txt",
    "https://cdn.adblockcdn.com/filters/distraction-control-push.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/distraction-control-survey.txt",
    "https://cdn.adblockcdn.com/filters/distraction-control-survey.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/distraction-control-video.txt",
    "https://cdn.adblockcdn.com/filters/distraction-control-video.txt",
  ];
  let subscribedTODC = false;
  for (const url of DISTRACTION_CONTROL_URL_LIST) {
    // eslint-disable-next-line no-await-in-loop
    subscribedTODC = await unsubscribeToFilterList(url);
  }

  if (subscribedTODC) {
    if (browser.runtime.getManifest().manifest_version === 2) {
      ewe.subscriptions.add("https://easylist-downloads.adblockplus.org/adblock_premium.txt", {
        reason: ewe.subscriptions.REASONS.MIGRATION,
      });
    }
    if (browser.runtime.getManifest().manifest_version === 3) {
      ewe.subscriptions.add(
        "https://easylist-downloads.adblockplus.org/v3/full/adblock_premium.txt",
        { reason: ewe.subscriptions.REASONS.MIGRATION },
      );
    }
  }
}

export default {
  migrateUserData,
};
