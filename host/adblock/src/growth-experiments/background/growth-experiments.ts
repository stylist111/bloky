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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { start as startCookieBannerExperiment } from "./cookie-banner";
import { experimentFlag as cookieBannerExperimentFlag } from "./cookie-banner.types";

/**
 * Starts the growth experiments module
 */
export async function start(): Promise<void> {
  const cookieBannerFlag = await ewe.experiments.getFlag(cookieBannerExperimentFlag);
  if (cookieBannerFlag === true) {
    startCookieBannerExperiment();
  }
}
