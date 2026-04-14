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

import type {
  TouchPointConfig,
  TouchPointConfigOverride,
} from "../shared/types.js";
import {
  TRIAL_DURATION_DAYS,
  MIDPOINT_THRESHOLD_DAYS,
  TOUCH_POINT_CONFIG_FLAG,
} from "../shared/constants.js";

/** Touch point 1: shown immediately after install */
const TOUCH_POINT_START: TouchPointConfig = {
  step: 1,
  titleKey: "reverse_trial_start_title",
  bodyKeys: [{ key: "reverse_trial_start_body", style: "paragraph" }],
  hasTarget: false,
  minElapsedDays: 0,
  learnMore: "reverse_trial_learn_more",
  autoDismissMs: 10000,
  showOnce: true,
  showFeedback: true,
};

/** Touch point 2: shown at the midpoint of the trial */
const TOUCH_POINT_MIDPOINT: TouchPointConfig = {
  step: 2,
  titleKey: "reverse_trial_midpoint_title",
  bodyKeys: [
    { key: "reverse_trial_midpoint_body_1", style: "paragraph" },
    { key: "reverse_trial_midpoint_body_2", style: "paragraph" },
  ],
  buttonKey: "reverse_trial_midpoint_premium_button",
  hasTarget: true,
  minElapsedDays: MIDPOINT_THRESHOLD_DAYS,
  showDismissLink: false,
  optOutKey: "reverse_trial_midpoint_opt_out",
  showOnce: true,
  showFeedback: true,
};

/** Touch point 3: shown when the trial has ended */
const TOUCH_POINT_ENDED: TouchPointConfig = {
  step: 3,
  titleKey: "reverse_trial_ended_title",
  bodyKeys: [
    { key: "reverse_trial_ended_body_1", style: "paragraph" },
    { key: "reverse_trial_ended_body_2", style: "paragraph" },
  ],
  buttonKey: "reverse_trial_ended_premium_button",
  hasTarget: true,
  minElapsedDays: TRIAL_DURATION_DAYS,
  showFeedback: true,
};

/** Touch point configurations in ascending step order */
const TOUCH_POINTS: TouchPointConfig[] = [
  TOUCH_POINT_START,
  TOUCH_POINT_MIDPOINT,
  TOUCH_POINT_ENDED,
];

/** The step number of the last touch point, used to mark the trial as ended */
export const LAST_TOUCH_POINT_STEP = TOUCH_POINTS[TOUCH_POINTS.length - 1].step;

/**
 * The touchpoint config can be overridden using the "reverse-trial-opd-config" experiment flag.
 *
 * For example, the flag's value could be set like so to disable the
 * auto-dismiss on step 1, and to show the dismiss link instead of the feedback
 * link on step 2.
 *
 * ```
 * {
 *   1: {
 *     autoDismissMs: null,
 *   },
 *   2: {
 *     showFeedback: false,
 *     showDismissLink: true
 *   }
 * }
 * ```
 */
async function getExperimentConfigOverride(
  step: number,
): Promise<TouchPointConfigOverride | undefined> {
  const flagValue = await ewe.experiments.getFlag(TOUCH_POINT_CONFIG_FLAG);

  if (typeof flagValue !== "object" || flagValue === null) {
    return undefined;
  }
  const stepValue = (flagValue as Record<string, unknown>)[String(step)];
  if (typeof stepValue !== "object" || stepValue === null) {
    return undefined;
  }

  const stepOverride: TouchPointConfigOverride = {};

  if ("autoDismissMs" in stepValue) {
    if (
      typeof stepValue.autoDismissMs === "number" ||
      stepValue.autoDismissMs === null
    ) {
      stepOverride.autoDismissMs = stepValue.autoDismissMs;
    }
  }

  if ("showFeedback" in stepValue) {
    if (
      typeof stepValue.showFeedback === "boolean" ||
      stepValue.showFeedback === null
    ) {
      stepOverride.showFeedback = stepValue.showFeedback;
    }
  }

  if ("showDismissLink" in stepValue) {
    if (
      typeof stepValue.showDismissLink === "boolean" ||
      stepValue.showDismissLink === null
    ) {
      stepOverride.showDismissLink = stepValue.showDismissLink;
    }
  }

  return stepOverride;
}

async function withConfigOverride(
  config: TouchPointConfig,
): Promise<TouchPointConfig> {
  const stepOverride = await getExperimentConfigOverride(config.step);
  if (!stepOverride) {
    return config;
  }

  const result = { ...config };

  if (typeof stepOverride.autoDismissMs === "number") {
    result.autoDismissMs = stepOverride.autoDismissMs;
  } else if (stepOverride.autoDismissMs === null) {
    delete result.autoDismissMs;
  }

  if (typeof stepOverride.showFeedback === "boolean") {
    result.showFeedback = stepOverride.showFeedback;
  } else if (stepOverride.showFeedback === null) {
    delete result.showFeedback;
  }

  if (typeof stepOverride.showDismissLink === "boolean") {
    result.showDismissLink = stepOverride.showDismissLink;
  } else if (stepOverride.showDismissLink === null) {
    delete result.showDismissLink;
  }

  return result;
}

/**
 * Determines the next touch point to show based on the last shown step
 * and elapsed trial days.
 *
 * Touch points must be shown in order (1 -> 2 -> 3) - once a touch point has
 * been shown earlier touch points will no longer be shown. A touch point is
 * only eligible once its time window is reached. Touch points may be skipped if
 * they are not checked before the next one is eligible.
 *
 * @param lastShownStep - The last touch point number that was shown
 * (0-3). 0 means none shown.
 * @param elapsedDays - The number of days elapsed since the trial started
 * @returns The config for the next touch point to show, or undefined if none is
 * eligible
 */
export async function resolveNextTouchPoint(
  lastShownStep: number,
  elapsedDays: number,
): Promise<TouchPointConfig | undefined> {
  const config = TOUCH_POINTS.slice()
    .reverse()
    .find(
      (config) =>
        lastShownStep < config.step && elapsedDays >= config.minElapsedDays,
    );
  if (!config) {
    return undefined;
  }
  return await withConfigOverride(config);
}

export async function getTouchPoint(
  step: number,
): Promise<TouchPointConfig | undefined> {
  const config = TOUCH_POINTS.find((config) => config.step === step);
  if (!config) {
    return undefined;
  }
  return await withConfigOverride(config);
}
