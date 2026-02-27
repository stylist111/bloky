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

import * as info from "info";
import { Prefs } from "./prefs";
import SubscriptionAdapter from "../subscriptionadapter";
import { getWebAllowlistingFilterCount } from "../telemetry/background/custom-rule";
import { getAAStatus } from "../telemetry/background/telemetry-base";
import { License } from "../picreplacement/check";
import { v4 as uuidv4 } from "uuid";

function booleanToURLBoolean(value) {
  return value ? "1" : "0";
}

async function getPremiumStatus() {
  await License.ready();
  const hasActiveLicense = await License.isActiveLicense();
  return booleanToURLBoolean(hasActiveLicense);
}

const UNINSTALL_BASE_URL = "https://getadblock.com/uninstall/";

export async function setUninstallURL() {
  if (browser.runtime.setUninstallURL) {
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
        await Prefs.untilLoaded;
        const isOptedOut = Prefs.get("data_collection_opt_out");

        const params = new URLSearchParams();

        if (!isOptedOut) {
          params.set("rcid", await ewe.telemetry.getRotatingClientId());

          // if the start property of blockCount exists (which is the AdBlock
          // installation timestamp)
          // use it to calculate the approximate length of time that user has
          // AdBlock installed
          const data = await browser.storage.local.get("blockage_stats");
          if (data && data.blockage_stats && data.blockage_stats.start) {
            const installedDuration = Date.now() - data.blockage_stats.start;
            params.set("t", installedDuration);
          }

          params.set("bc", Prefs.blocked_total);
          params.set("er", await ewe.remoteConfig.getRevisionId());
          params.set("ev", await ewe.experiments.getEncodedExperiments());
          params.set("ca", await ewe.cohorts.getEncodedCohorts());
          params.set("lt", await getLastUpdateTime());
          params.set("wafc", await getWebAllowlistingFilterCount());

          // CDP data
          params.set("ps", await getPremiumStatus());
          params.set("aa", await getAAStatus());
        } else {
          // We need some unique transaction ID in the URL so that we can count
          // unique uninstall events, even if the uninstall page is
          // refreshed. If the user is opted in to data collection, then we can
          // use the rotating client id that we attach to log messages. If the
          // user is opted out, we don't want to send any actual identifying
          // information, so a randomly generated session id is sufficient. This
          // ID intentionally isn't stored in the extension so that it can't be
          // linked to other user data.
          params.set("rcid", uuidv4());
        }

        params.set("av", info.addonVersion);

        browser.runtime.setUninstallURL(`${UNINSTALL_BASE_URL}?${params}`);
      };

      let uninstallURLInterval = null;

      const addOptedInListeners = function () {
        ewe.remoteConfig.onChanged.addListener(updateUninstallURL);
        ewe.experiments.onChanged.addListener(updateUninstallURL);
        ewe.cohorts.onChanged.addListener(updateUninstallURL);
        ewe.telemetry.onRotatingClientIdChanged.addListener(updateUninstallURL);
        // start an interval timer that will update the Uninstall URL every 2
        // minutes
        uninstallURLInterval = setInterval(updateUninstallURL, twoMinutes);
      };

      const removeOptedInListeners = function () {
        ewe.remoteConfig.onChanged.removeListener(updateUninstallURL);
        ewe.experiments.onChanged.removeListener(updateUninstallURL);
        ewe.cohorts.onChanged.removeListener(updateUninstallURL);
        ewe.telemetry.onRotatingClientIdChanged.removeListener(updateUninstallURL);
        clearInterval(uninstallURLInterval);
        uninstallURLInterval = null;
      };

      await Prefs.untilLoaded;
      updateUninstallURL();
      if (!Prefs.get("data_collection_opt_out")) {
        addOptedInListeners();
      }

      Prefs.on("data_collection_opt_out", async () => {
        await updateUninstallURL();
        if (Prefs.get("data_collection_opt_out")) {
          removeOptedInListeners();
        } else {
          addOptedInListeners();
        }
      });
    } else {
      const params = new URLSearchParams();
      params.set("t", -1);
      browser.runtime.setUninstallURL(`${UNINSTALL_BASE_URL}?${params}`);
    }
  }
}
