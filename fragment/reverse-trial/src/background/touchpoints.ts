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

import type { TouchPointConfig } from "../shared/types.js";
import {
  TRIAL_DURATION_DAYS,
  MIDPOINT_THRESHOLD_DAYS,
} from "../shared/constants.js";

/** Touch point 1: shown immediately after install */
const TOUCH_POINT_START: TouchPointConfig = {
  step: 1,
  titleKey: "reverse_trial_start_title",
  bodyKeys: [
    { key: "reverse_trial_start_body_1", style: "paragraph" },
    { key: "reverse_trial_start_body_2", style: "paragraph" },
  ],
  buttonKey: "reverse_trial_start_button",
  hasTarget: false,
  minElapsedDays: 0,
  learnMore: "reverse_trial_learn_more",
};

/** Touch point 2: shown at the midpoint of the trial */
const TOUCH_POINT_MIDPOINT: TouchPointConfig = {
  step: 2,
  titleKey: "reverse_trial_midpoint_title",
  bodyKeys: [{ key: "reverse_trial_midpoint_body", style: "paragraph" }],
  buttonKey: "reverse_trial_premium_button",
  hasTarget: true,
  minElapsedDays: MIDPOINT_THRESHOLD_DAYS,
};

/** Touch point 3: shown when the trial has ended */
const TOUCH_POINT_ENDED: TouchPointConfig = {
  step: 3,
  titleKey: "reverse_trial_ended_title",
  bodyKeys: [{ key: "reverse_trial_ended_body", style: "paragraph" }],
  buttonKey: "reverse_trial_premium_button",
  hasTarget: true,
  minElapsedDays: TRIAL_DURATION_DAYS,
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
export function resolveNextTouchPoint(
  lastShownStep: number,
  elapsedDays: number,
): TouchPointConfig | undefined {
  return TOUCH_POINTS.slice()
    .reverse()
    .find(
      (config) =>
        lastShownStep < config.step && elapsedDays >= config.minElapsedDays,
    );
}
