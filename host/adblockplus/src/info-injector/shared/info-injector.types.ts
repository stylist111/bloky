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
   * The installation id
   */
  id: string;
  /**
   * The premium user id
   */
  premiumId: string;
  /**
   * The number of blocked requests
   */
  blockCount: number;
  /**
   * The timestamp (milliseconds since epoch) when the extension was installed,
   * or `0` when unset (e.g. profile predates install-date tracking).
   */
  installDate: number;
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
