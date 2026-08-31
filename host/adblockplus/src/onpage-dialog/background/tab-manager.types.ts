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
 * The key under which we store the timestamp of the last time we showed a
 * dialog.
 */
export const lastShownKey = "onpage_dialog_last_shown";

/**
 * The key under which we store the minimum amount of time between two
 * dialogs being shown.
 */
export const coolDownPeriodKey = "onpage_dialog_cool_down";

/**
 * Options for removing an on-page dialog
 */
export interface RemoveDialogOptions {
  /**
   * Whether the dialog should be kept in storage, so that it can be shown
   * again later
   */
  keepStorage?: boolean;
  /**
   * Whether the user explicitly dismissed the dialog, by closing it or by
   * interacting with its button
   */
  userDismissed?: boolean;
}

/**
 * Results when attempting to show on-page dialog
 */
export enum ShowOnpageDialogResult {
  /**
   * Dialog wasn't shown but can be retried
   */
  ignored,
  /**
   * Dialog wasn't shown and should not be retried
   */
  rejected,
  /**
   * Dialog was shown
   */
  shown,
  /**
   * Error during processing
   */
  error
}

/**
 * Cause of OPD display termination, used in the dialog_display_duration
 * telemetry event
 */
export type TerminationCause = "tab_navigated" | "tab_removed";

/**
 * Events of the persistent_opd telemetry module. Must match the event names
 * declared for that module in the SDK's events registry, which the registry
 * cannot enforce from here: an event it doesn't know is dropped when emitted.
 */
export type PersistentOpdEvent =
  | "rendered"
  | "clicked"
  | "closed"
  | "ignored"
  | "exhausted"
  | "injection_failed";

/**
 * How an impression ended, reported by the ignored event. A dialog with no
 * display duration can only end by the tab going away, so the two termination
 * causes carry over and only the timed case is added.
 */
export type ImpressionEndReason = TerminationCause | "display_duration_elapsed";

/**
 * Why the dialog could not be put on the page, reported by the
 * injection_failed event
 */
export type InjectionFailureReason = "no_receiver" | "no_tab" | "other";
