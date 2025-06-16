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
/* global browser, ewe */

/** @module uninstall */
/** similar to adblockpluschrome\lib\uninstall.js */

import { Prefs } from "./prefs";
import SubscriptionAdapter from "../subscriptionadapter";
import { getUserId } from "../id/background/index";
import { getWebAllowlistingFilterCount } from "../telemetry/background/custom-rule";
import { getAAStatus } from "../telemetry/background/telemetry-base";
import { License } from "../picreplacement/check";

function booleanToURLBoolean(value) {
  return value ? "1" : "0";
}

async function getPremiumStatus() {
  await License.ready();
  const hasActiveLicense = License.isActiveLicense();
  return booleanToURLBoolean(hasActiveLicense);
}

/**
 * Converts BigInt number to bytes array
 *
 * @param {BigInt} bn - Number
 * @returns {Uint8Array} bytes array
 */
function bnToBytes(bn) {
  let hex = BigInt(bn).toString(16);
  if (hex.length % 2) hex = `0${hex}`;

  const length = hex.length / 2;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);

  return bytes;
}

/**
 * Retrieves split experiments assignments. It is compressed as base64-encoded
 * bitmap due to limited space in the uninstall URL.
 * @link https://eyeo.atlassian.net/browse/DATA-2793
 *
 * @returns {Promise<string>} split experiments assignments
 */
export async function getExperiments() {
  let variantsBitmap = 0n;

  const experiments = await ewe.experiments.getExperiments();
  for (const experiment of [...experiments].reverse()) {
    for (const variant of [...experiment.variants].reverse()) {
      variantsBitmap |= variant.assigned ? 1n : 0n;
      variantsBitmap <<= 1n;
    }
  }
  variantsBitmap >>= 1n;

  const bytes = bnToBytes(variantsBitmap);
  const base64 = btoa(String.fromCharCode(...bytes));

  return base64;
}

export async function setUninstallURL() {
  if (browser.runtime.setUninstallURL) {
    const userID = await getUserId();
    let uninstallURL = "https://getadblock.com/uninstall/?u=" + userID;
    // if the start property of blockCount exists (which is the AdBlock
    // installation timestamp)
    // use it to calculate the approximate length of time that user has
    // AdBlock installed
    if (Prefs && Prefs.blocked_total !== undefined) {
      const twoMinutes = 2 * 60 * 1000;
      const getLastUpdateTime = async function () {
        const userSubs = await SubscriptionAdapter.getSubscriptionsMinusText();
        let maxLastDownload = -1;
        for (const sub in userSubs) {
          if (userSubs[sub].lastSuccess > maxLastDownload) {
            maxLastDownload = userSubs[sub].lastSuccess;
          }
        }
        return maxLastDownload;
      };
      const updateUninstallURL = async function () {
        const data = await browser.storage.local.get("blockage_stats");
        let url = uninstallURL;

        if (data && data.blockage_stats && data.blockage_stats.start) {
          const installedDuration = Date.now() - data.blockage_stats.start;
          url = `${url}&t=${installedDuration}`;
        }

        const bc = Prefs.blocked_total;
        url = `${url}&bc=${bc}`;

        const experimentsRevision = await ewe.remoteConfig.getRevisionId();
        url = `${url}&er=${encodeURIComponent(experimentsRevision)}`;
        const experimentsVariants = await getExperiments();
        url = `${url}&ev=${encodeURIComponent(experimentsVariants)}`;

        const cohortAssignments = await ewe.cohorts.getEncodedCohorts();
        url = `${url}&ca=${encodeURIComponent(cohortAssignments)}`;

        const lastUpdateTime = await getLastUpdateTime();
        url = `${url}&lt=${lastUpdateTime}`;
        url = `${url}&wafc=${await getWebAllowlistingFilterCount()}`;

        // CDP data
        url = `${url}&ps=${await getPremiumStatus()}`;
        url = `${url}&aa=${await getAAStatus()}`;

        browser.runtime.setUninstallURL(url);
      };
      // start an interval timer that will update the Uninstall URL every 2
      // minutes
      setInterval(updateUninstallURL, twoMinutes);
      updateUninstallURL();
    } else {
      browser.runtime.setUninstallURL(`${uninstallURL}&t=-1`);
    }
  }
}
