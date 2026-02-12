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
import { getUserId } from "../id/background/index";
import { getWebAllowlistingFilterCount } from "../telemetry/background/custom-rule";
import { getAAStatus } from "../telemetry/background/telemetry-base";
import { License } from "../picreplacement/check";

function booleanToURLBoolean(value) {
  return value ? "1" : "0";
}

async function getPremiumStatus() {
  await License.ready();
  const hasActiveLicense = await License.isActiveLicense();
  return booleanToURLBoolean(hasActiveLicense);
}

const LOGGING_FLAG = "ab-servermessages-logging-enabled";

const UNINSTALL_BASE_URL = "https://getadblock.com/uninstall/";

export async function setUninstallURL() {
  if (browser.runtime.setUninstallURL) {
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
        const params = new URLSearchParams();
        if (await ewe.experiments.getFlag(LOGGING_FLAG)) {
          params.set("u", await getUserId());
        }

        params.set("rcid", await ewe.telemetry.getRotatingClientId());
        params.set("av", info.addonVersion);

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

        browser.runtime.setUninstallURL(`${UNINSTALL_BASE_URL}?${params}`);
      };
      // start an interval timer that will update the Uninstall URL every 2
      // minutes
      setInterval(updateUninstallURL, twoMinutes);
      updateUninstallURL();

      // listen for changes to the remote config, experiments, cohorts and rotating client ID
      ewe.remoteConfig.onChanged.addListener(updateUninstallURL);
      ewe.experiments.onChanged.addListener(updateUninstallURL);
      ewe.cohorts.onChanged.addListener(updateUninstallURL);
      ewe.telemetry.onRotatingClientIdChanged.addListener(updateUninstallURL);
    } else {
      const params = new URLSearchParams();
      if (await ewe.experiments.getFlag(LOGGING_FLAG)) {
        params.set("u", await getUserId());
      }
      params.set("t", -1);
      browser.runtime.setUninstallURL(`${UNINSTALL_BASE_URL}?${params}`);
    }
  }
}
