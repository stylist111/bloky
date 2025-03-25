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

import * as info from "info";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { type InjectionInfo } from "../shared";
import { getUserId } from "../../../adblock-betafish/id/background/index";
import { License } from "../../../adblock-betafish/picreplacement/check";
import { Prefs } from "../../../adblock-betafish/alias/prefs";

/**
 * Collects the info to inject.
 *
 * @returns The info to inject
 */
export async function getInjectionInfo(): Promise<InjectionInfo> {
  await Prefs.untilLoaded;
  const isPremium = License.isActiveLicense();
  const version = info.addonVersion;
  const id = await getUserId();
  const blockCount = Prefs.get("blocked_total");
  const experimentFlags = await ewe.experiments.getFlags();

  return { isPremium, version, id, blockCount, experimentFlags };
}
