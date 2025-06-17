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

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import * as logger from "~/logger/background";

async function applyOptOut(): Promise<void> {
  const isOptedOut = Prefs.get("data_collection_opt_out");

  await ewe.telemetry.setOptOut(
    typeof isOptedOut === "boolean" ? isOptedOut : true
  );
}

/**
 * Initializes user counting functionality
 */
export async function start(): Promise<void> {
  try {
    await Prefs.untilLoaded;

    await applyOptOut();
    Prefs.on("data_collection_opt_out", applyOptOut);
  } catch (error) {
    logger.reportAndLogError(
      error,
      "Eyeometry-based MAC counting initialization failed"
    );
  }
}
