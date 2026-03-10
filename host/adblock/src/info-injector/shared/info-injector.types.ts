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

/**
 * The name of the command we send in a message to the background page.
 */
export const getInfoCommand = "getInjectionInfo";

/**
 * The info we inject.
 */
export interface InjectionInfo {
  /**
   * Whether the user is a premium user
   */
  isPremium: boolean;
  /**
   * Whether the user is a trial user
   */
  isTrial: boolean;
  /**
   * The version of the extension
   */
  version: string;
  /**
   * The user id
   */
  id: string;
  /**
   * The number of blocked requests
   */
  blockCount: number;
  /**
   * All feature flags for the user, including overridden flags and their values
   */
  experimentFlags: Record<string, unknown>;
  /**
   * The revision ID from remote configuration
   */
  er: string | null;
  /**
   * The encoded experiments variants
   */
  ev: string;
  /**
   * The encoded cohort assignments
   */
  ca: string;
}
