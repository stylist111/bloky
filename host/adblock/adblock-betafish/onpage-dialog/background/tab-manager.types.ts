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

import { Tabs } from "webextension-polyfill";

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
  injected = "dialog_injected",
  injected_error = "dialog_injected_error",
  initial_ping = "ping.initial",
  received = "received",
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
  error,
}

/**
 * On-page dialog error event names
 *
 * @deprecated only used for recording events for @eyeo-fragments/ipm-legacy
 */
export enum DialogErrorEventType {
  error_no_dialog_found = "error.no_ipm",
  get_no_dialog_found = "get.no_dialog",
  ping_no_dialog_found = "ping.no_dialog",
}

/**
 * Interface for a Page shown in tab
 */
export interface TabPage {
  id: Tabs.Tab["id"];
  url: URL;
}
