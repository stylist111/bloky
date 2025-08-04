/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { type Tabs } from "webextension-polyfill";

export const ytAllowlistStartDate = "yt_allowlist_start_date";

/**
 * Parameters used to uniquely identify a tab or site
 *
 */
export interface TabDescriptor {
  id?: Tabs.Tab["id"];
  url?: URL;
}

/**
 * Function to add trusted message types for certain origins
 *
 */
export type sendAdWallEventsFunction = (
  eventMessage: string,
  additionalParams?: any,
) => void;

/**
 * Function to add trusted message types for certain origins
 *
 */
export type addTrustedMessageTypesFunction = (
  origin: string | null,
  types: string[],
) => void;

/**
 * A no-op Function type
 *
 */
export type noopFunction = () => void;

/**
 * A no-op Function declartion
 *
 */
export const noop: noopFunction = () => {};

/**
 * Interface for the start ad wall detection
 * Note: The use of the 'any' type below is a temporary solution
 *       Once a core utility for these 'any' objects are created, it is
 *       expected that type information below be updated
 */
export interface StartInfo {
  /**
   * A reference to a function will add the message types
   * that are needed from the content script.
   *
   */
  addTrustedMessageTypes: addTrustedMessageTypesFunction;

  /**
   * A reference to the logger object
   *
   */
  logger: any;

  /**
   * A reference to the port object
   *
   */
  port: any;

  /**
   * A reference to a Prefs object
   *
   */
  prefs: any;

  /**
   * A reference to a function will send event messages
   *
   */
  sendAdWallEvents: sendAdWallEventsFunction | undefined;

  /**
   * Function to get the premium state of the user
   */
  isPremiumActive: () => Promise<boolean>;
}
