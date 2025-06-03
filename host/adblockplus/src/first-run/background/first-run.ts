/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Prefs } from "../../../adblockpluschrome/lib/prefs";

interface EngineAnalytics {
  data?: {
    currentVersion?: string;
    firstVersion?: string;
  };
  trustedHosts?: string[];
}

interface StorageEngineAnalyticsValue {
  "abp:pref:analytics"?: EngineAnalytics;
}

/**
 * Approximates the installation date based on the engine analytics data.
 *
 * @return {number} The approximate installation date
 */
async function approximateInstallDate(): Promise<number> {
  const { "abp:pref:analytics": analytics } = (await browser.storage.local.get(
    "abp:pref:analytics"
  )) as StorageEngineAnalyticsValue;

  const version = analytics?.data?.firstVersion;

  if (!version || version === "0") {
    return Date.now();
  }

  const year = version.substring(0, 4);
  const month = version.substring(4, 6);
  const date = version.substring(6, 8);

  return new Date(`${year}-${month}-${date}`).getTime();
}

/**
 * Sets the installation date in the prefs.
 *
 * @param installReason The reason for the installation
 */
async function setInstallDate(installReason: string): Promise<void> {
  if (installReason === "install") {
    await Prefs.untilLoaded;
    await Prefs.set("installDate", Date.now());
  } else if (installReason === "update") {
    // TODO: remove this migration after clients upgrade
    await Prefs.untilLoaded;
    const installDate = await Prefs.get("installDate");
    if (!installDate) {
      // Set a default install date for older extensions
      const timestamp = await approximateInstallDate();
      await Prefs.set("installDate", timestamp);
    }
  }
}

/**
 * Sets the installation date in the prefs.
 */
export function start(): void {
  browser.runtime.onInstalled.addListener((details) => {
    const { reason } = details;
    void setInstallDate(reason);
  });
}
