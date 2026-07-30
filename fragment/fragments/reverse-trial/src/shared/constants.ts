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

/**
 * Prefix for the remote flag that gates the reverse trial feature.
 *
 * Actual flag names are `<prefix><experiment-id>` — each concurrent
 * reverse-trial experiment appends its own identifier so the
 * experiments framework (which rejects duplicate flag names across
 * experiments) accepts multiple variants. See the Confluence page for
 * the naming convention.
 */
export const EXPERIMENT_FLAG_PREFIX = "show-reverse-trial-opd-";

/** Prefix for the flag holding the OPD config object. Same convention
 *  as {@link EXPERIMENT_FLAG_PREFIX}. */
export const TOUCH_POINT_CONFIG_FLAG_PREFIX = "reverse-trial-opd-config-";

/** Message type sent from content script to service worker */
export const GET_DIALOG_MESSAGE_TYPE = "reverse-trial.get-dialog";

/** Pref key storing the last shown touch point step id */
export const STEP_PREF_KEY = "reverse_trial_step";

/** Pref key for the trial start date (epoch ms), set on first visit to a matched site */
export const TRIAL_START_DATE_PREF_KEY = "reverse_trial_start_date";

/** Message type sent from content script when user interacts with the dialog */
export const DIALOG_ACTION_MESSAGE_TYPE = "reverse-trial.dialog-action";

/**
 * Message type sent from the content script once the dialog has actually
 * been rendered on the page. The `dialog_shown` telemetry is emitted in
 * response to this — not when the service worker builds the payload — so
 * the impression is only counted for the extension that truly displayed
 * the OPD. When both AdBlock and Adblock Plus are installed, the one that
 * loses the shared-DOM render race never sends this message.
 */
export const DIALOG_SHOWN_MESSAGE_TYPE = "reverse-trial.dialog-shown";

/** Message type broadcast from service worker to all tabs to close the dialog */
export const DISMISS_DIALOG_MESSAGE_TYPE = "reverse-trial.dismiss-dialog";

/** Message type sent from content script to check if a visible dialog should still be shown */
export const GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE =
  "reverse-trial.get-dialog-should-still-show";

/**
 * Attribute set on the dialog host element in the page's light DOM.
 *
 * Both AdBlock and Adblock Plus ship this same fragment, so when both
 * are installed they would each try to render an OPD on the same
 * YouTube tab. The attribute lets whichever content script renders
 * first mark the page; the other detects it and skips, so only one
 * dialog is ever shown. Being a plain DOM attribute (not cross-extension
 * messaging), this works in every browser.
 */
export const DIALOG_MARKER_ATTRIBUTE = "data-rt-opd";

/** Milliseconds in one day */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * How long the content script waits for YouTube's `#masthead` element to
 * appear before assuming the user is non-Premium. YouTube usually renders
 * the masthead within a second; 10s is a generous safety margin for slow
 * connections without delaying the dialog indefinitely.
 */
export const YT_MASTHEAD_TIMEOUT_MS = 10000;
