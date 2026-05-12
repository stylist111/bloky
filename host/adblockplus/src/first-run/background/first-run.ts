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

/**
 * Sets the installation date in the prefs.
 *
 * @param installReason The reason for the installation
 */
async function setInstallDate(installReason: string): Promise<void> {
  if (installReason === "install") {
    await Prefs.untilLoaded;
    await Prefs.set("installDate", Date.now());
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
