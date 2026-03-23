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

/** Remote experiment flag that gates the reverse trial feature */
export const EXPERIMENT_FLAG = "show-reverse-trial-opd";

/** Message type sent from content script to service worker */
export const GET_DIALOG_MESSAGE_TYPE = "reverse-trial.get-dialog";

/** Pref key storing the last shown touch point number (0-3) */
export const STEP_PREF_KEY = "reverse_trial_step";

/** Pref key for the trial start date (epoch ms), set on first visit to a matched site */
export const TRIAL_START_DATE_PREF_KEY = "reverse_trial_start_date";

/** Message type sent from content script when user dismisses a dialog */
export const DIALOG_ACTION_MESSAGE_TYPE = "reverse-trial.dialog-action";

/** Message type broadcast from service worker to all tabs to close the dialog */
export const DISMISS_DIALOG_MESSAGE_TYPE = "reverse-trial.dismiss-dialog";

/** Total duration of the trial period in days */
export const TRIAL_DURATION_DAYS = 14;

/** Days from the start of the trial at which the midpoint dialog is shown */
export const MIDPOINT_THRESHOLD_DAYS = 7;

/** Milliseconds in one day */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
