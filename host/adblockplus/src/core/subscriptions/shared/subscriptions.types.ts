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

/**
 * Recommendation type of the free "Hide AI search summaries" filter list
 */
export const AI_SUMMARIES_SUBSCRIPTION_TYPE = "ai-summaries";

/**
 * Experiment flag that controls the staged rollout of the "Hide AI search
 * summaries" option (see the "ai-summaries-rollout" experiment in
 * experiments.json in the ab-testing-config repository). Users with the flag
 * see a toggle in the popup and the option in the options page. Users without
 * it see nothing, unless they already turned the list on.
 */
export const AI_SUMMARIES_FLAG = "ai-summaries-enabled";
