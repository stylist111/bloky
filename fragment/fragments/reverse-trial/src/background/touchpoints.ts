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

import type { RemoteStepConfig, RemoteTrialConfig } from "../shared/types.js";

/**
 * Returns the highest step id in the config. Steps advance up to and
 * including this value — once the step pref equals this, no more OPDs
 * show and the trial is considered ended.
 */
export function getLastStepId(config: RemoteTrialConfig): number {
  return Math.max(...config.steps.map((step) => step.id));
}

/**
 * Resolves the next eligible step based on the last shown step id and
 * elapsed days since trial start.
 *
 * Picks the highest-id step whose window contains `elapsedDays` and
 * whose `id` is greater than `lastShownStep`. Steps outside their
 * window are skipped entirely — a user who misses an OPD's window does
 * not see it later.
 */
export function resolveNextTouchPoint(
  config: RemoteTrialConfig,
  lastShownStep: number,
  elapsedDays: number,
): RemoteStepConfig | undefined {
  let best: RemoteStepConfig | undefined;
  for (const step of config.steps) {
    const eligible =
      lastShownStep < step.id &&
      elapsedDays >= step.minElapsedDays &&
      (step.maxElapsedDays === undefined || elapsedDays <= step.maxElapsedDays);
    if (eligible && (best === undefined || step.id > best.id)) {
      best = step;
    }
  }
  return best;
}

/**
 * Returns the step config with the given id, or undefined if no such
 * step exists. Used by the service worker to resolve a dialog-action
 * message back to its configured behavior.
 */
export function getStepById(
  config: RemoteTrialConfig,
  step: number,
): RemoteStepConfig | undefined {
  return config.steps.find((s) => s.id === step);
}
