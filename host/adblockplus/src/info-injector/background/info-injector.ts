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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { getInstallationId } from "../../id/background";
import { info } from "../../info/background";
import { type InjectionInfo } from "../shared";
import { addTrustedMessageTypes, port } from "~/core/messaging/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getPremiumState } from "../../premium/background";

/**
 * Handles "info.getInjectionInfo" messages
 *
 * @returns an object containing the info to be injected on product websites.
 */
async function handleGetInjectionInfo(): Promise<InjectionInfo> {
  await Prefs.untilLoaded;
  const { isActive: isPremium } = await getPremiumState();
  const trial = await ewe.account.getTrial();
  const isTrial = trial?.abp ?? false;
  const version = info.addonVersion;
  const id = await getInstallationId();
  const premiumId = Prefs.get("premium_user_id");
  const blockCount = Prefs.get("blocked_total");
  const experimentFlags = await ewe.experiments.getFlags();
  return {
    isPremium,
    isTrial,
    version,
    id,
    premiumId,
    blockCount,
    experimentFlags
  };
}

/**
 * Starts the infoInjector feature
 */
export function start(): void {
  port.on("info.getInjectionInfo", handleGetInjectionInfo);

  addTrustedMessageTypes(null, ["info.getInjectionInfo"]);
}
