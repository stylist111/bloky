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

/**
 * Experiment flag that controls the staged rollout of the "Hide AI search
 * summaries" option (see the "ai-summaries-rollout" experiment in
 * experiments.json in the ab-testing-config repository). Users with the flag
 * see the toggle in the popup and the list in the Filter lists tab. Users
 * without it see nothing, unless they already turned the list on.
 */
export const AI_SUMMARIES_FLAG = "ai-summaries-enabled";

/**
 * Checks whether the "Hide AI search summaries" option is rolled out to the
 * current user, based on the experiment flags
 *
 * @param flags - All experiment flags of the current user
 *
 * @returns whether the option is rolled out to the user
 */
export function isAiSummariesRolledOut(flags: Record<string, unknown> | undefined): boolean {
  // The flags are not available while the background is restarting
  return flags?.[AI_SUMMARIES_FLAG] === true;
}
