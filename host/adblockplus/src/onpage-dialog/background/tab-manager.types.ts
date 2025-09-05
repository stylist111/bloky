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
 * On-page dialog event names
 *
 * @deprecated only used for recording events for @eyeo-fragments/ipm-legacy
 */
export enum DialogEventType {
  buttonClicked = "dialog_button_clicked",
  closed = "dialog_closed",
  ignored = "dialog_ignored",
  injected = "dialog_injected"
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
