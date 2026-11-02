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

import {
  AI_SUMMARIES_FLAG,
  AI_SUMMARIES_SUBSCRIPTION_TYPE
} from "./subscriptions.types";

/**
 * Checks whether the "Hide AI search summaries" option is rolled out to the
 * current user, based on the experiment flags
 *
 * @param flags - All experiment flags of the current user
 *
 * @returns whether the option is rolled out to the user
 */
export function isAiSummariesRolledOut(
  flags: Record<string, unknown> | undefined
): boolean {
  // The flags are not available while the background is restarting
  return flags?.[AI_SUMMARIES_FLAG] === true;
}

/**
 * Checks whether the "Hide AI search summaries" option should be shown in
 * the options page
 *
 * @param isRolledOut - Whether the option is rolled out to the user
 * @param isEnabled - Whether the user already turned the filter list on
 *
 * @returns whether the option should be shown
 */
export function isAiSummariesVisible(
  isRolledOut: boolean,
  isEnabled: boolean
): boolean {
  // Users who opted in keep seeing the option even if they are not (or no
  // longer) part of the experiment, so they can turn it off again
  return isRolledOut || isEnabled;
}

/**
 * Recommendation types of free filter lists that are shown with a "New"
 * label in the options page
 *
 * The "New" label and the pinning to the top of the free features only apply
 * while a filter list is new, after which its type is removed from here
 */
export const newFreeTypes = new Set([AI_SUMMARIES_SUBSCRIPTION_TYPE]);

/**
 * Checks whether a filter list is shown with a "New" label
 *
 * @param type - Recommendation type of the filter list
 *
 * @returns whether the filter list is marked as new
 */
export function isNewFreeType(type: unknown): boolean {
  return typeof type === "string" && newFreeTypes.has(type);
}

/**
 * Compares two filter lists so that the ones marked as new sort first
 *
 * @param a - First filter list
 * @param b - Second filter list
 *
 * @returns a negative number if only `a` is new, a positive number if only
 *   `b` is new, and 0 if both or neither are new, so that other sort criteria
 *   can apply
 */
export function compareByNewFreeType(
  a: { recommended?: unknown },
  b: { recommended?: unknown }
): number {
  const aNew = isNewFreeType(a.recommended);
  const bNew = isNewFreeType(b.recommended);
  if (aNew === bNew) {
    return 0;
  }
  return aNew ? -1 : 1;
}
