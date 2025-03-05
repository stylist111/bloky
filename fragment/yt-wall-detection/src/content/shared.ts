/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as browser from "webextension-polyfill";

import {
  ytHavenIframeFlag,
  ytHavenOverlayFlag,
  ytHavenModalFlag,
} from "../shared/index.js";
import { type PartialPrivateExperimentsData } from "./shared.types.js";

/**
 * Storage key for the experiments
 */
const expStorageKey = "ewe:split_experiments";

/**
 * Retrieves the experiment flag from local storage
 *
 * @param flagId The the experiment flag
 */
export async function getExperimentFlag(flagId: string): Promise<any> {
  const storedData = await browser.storage.local.get(expStorageKey);
  const experiments = storedData[expStorageKey];

  if (!isPartialPrivateExperimentsData(experiments)) {
    return null;
  }

  if (
    experiments.overrides &&
    typeof experiments.overrides[flagId] !== "undefined"
  ) {
    return experiments.overrides[flagId];
  }

  if (experiments.flags && typeof experiments.flags[flagId] !== "undefined") {
    return experiments.flags[flagId];
  }

  return null;
}

/**
 * Checks if the user is in one of the YT Heaven experiments
 */
export async function isInHavenExperiment(): Promise<boolean> {
  const ytHeavenFlags = await Promise.all([
    getExperimentFlag(ytHavenIframeFlag),
    getExperimentFlag(ytHavenOverlayFlag),
    getExperimentFlag(ytHavenModalFlag),
  ]);
  return ytHeavenFlags.some((result) => Boolean(result));
}

/**
 * Checks if the current path is /watch
 */
export function isWatchPage(): boolean {
  const pathName = window.location.pathname;

  return pathName === "/watch" || pathName.startsWith("/watch/");
}

/**
 * Checks whether given candidate represents relevants parts of stored split
 * experiments data
 *
 * @param candidate - Candidate
 *
 * @returns whether given candidate represents relevants parts of stored split
 * experiments data
 */
function isPartialPrivateExperimentsData(
  candidate: unknown,
): candidate is PartialPrivateExperimentsData {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "flags" in candidate &&
    "overrides" in candidate
  );
}
