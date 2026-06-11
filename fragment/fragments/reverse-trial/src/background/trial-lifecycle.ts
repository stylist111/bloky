/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import type { RemoteTrialConfig, StartInfo } from "../shared/types.js";
import {
  STEP_PREF_KEY,
  TRIAL_START_DATE_PREF_KEY,
} from "../shared/constants.js";
import { getLastStepId } from "./touchpoints.js";

/**
 * Advances the trial step pref. Enforces monotonicity so a late-arriving
 * dialog-action message from a previous step (e.g. a stale tab closing
 * after the user already progressed) cannot roll the step backward.
 */
export async function advanceTrialStep(
  params: StartInfo,
  newStep: number,
): Promise<void> {
  const currentStep =
    (params.prefs.get(STEP_PREF_KEY) as number | undefined) ?? 0;
  if (currentStep < newStep) {
    await params.prefs.set(STEP_PREF_KEY, newStep);
  }
}

/**
 * Starts the reverse trial: stamps `pref:reverse_trial_start_date` with
 * the current time and activates Lightning Snippets via the SDK
 * caller-opinion API. Used both for auto-enrollment (variants without
 * `requireOptIn`, on first eligible visit) and for opt-in flows (when
 * a `START_TRIAL` action fires).
 */
export async function startTrial(params: StartInfo): Promise<void> {
  await params.prefs.set(TRIAL_START_DATE_PREF_KEY, Date.now());
  await ewe.lightningSnippets.enable();
}

/**
 * Marks the trial as ended: advances the step pref to the last
 * configured step and releases any lightning-snippets caller opinion so
 * the precedence chain (experiment flag → caller opinion → hasPremium →
 * default) resolves cleanly. Clearing (not disabling) is correct for
 * every caller, including Premium users who upgrade mid-trial — pinning
 * caller opinion to `false` would perversely suppress lightning snippets
 * for a user whose `hasPremium` rung would otherwise enable them.
 */
export async function endTrial(
  params: StartInfo,
  config: RemoteTrialConfig,
): Promise<void> {
  await advanceTrialStep(params, getLastStepId(config));
  await ewe.lightningSnippets.clear();
}
