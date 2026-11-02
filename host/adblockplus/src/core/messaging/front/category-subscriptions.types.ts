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
 * Options sent to subscriptions.add
 */
export interface AddOptions {
  /**
   * Whether user needs to confirm adding the subscription
   **/
  confirm?: boolean;

  /**
   * Subscription homepage URL
   **/
  homepage?: string;

  /**
   * Subscription title
   **/
  title?: string;

  /**
   * Subscription URL
   */
  url: string;
}

/**
 * Options sent into subscription.get.
 */
export interface GetOptions {
  /**
   * Whether to return only the disabled filters.
   */
  disabledFilters?: boolean;

  /**
   * Whether or not to ignore filters that are disabled
   */
  ignoreDisabled?: boolean;
}

/**
 * Information indicating presence of initialization issues
 */
export interface InitializationIssues {
  /**
   * Whether data corruption has been detected
   */
  dataCorrupted: boolean;

  /**
   * Whether filter settings have been reset
   */
  reinitialized: boolean;
}

/**
 * Options sent to subscriptions.toggle
 **/
export interface ToggleOptions {
  /**
   * Whether to disable the subscription instead of removing it, if it is
   * installed and enabled
   **/
  keepInstalled?: boolean;

  /**
   * Subscription URL
   **/
  url: string;
}

/**
 * Options sent to subscriptions.remove
 **/
export interface RemoveOptions {
  /**
   * Subscription URL
   **/
  url: string;
}
