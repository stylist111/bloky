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
 * Information about the extension
 */
export interface ExtensionInfo {
  /**
   * Short name of the extension
   */
  name: string;

  /**
   * Version of the extension
   */
  version: string;

  /**
   * State of the allowlist
   */
  allowlistState: AllowlistState;
}

/**
 * Information about the allowlist state
 */
export interface AllowlistState {
  /**
   * Whether the allowlist is active
   */
  status: boolean;

  /**
   * Source of the allowlist (null, "1ca", or "user")
   */
  source: string | null;

  /**
   * Whether one-click activation is available
   */
  oneCA: boolean;
}

/**
 * Response from the server for GetAuthPayload
 */
export interface PayloadAndExtensionInfo {
  /**
   * Information about the extension
   */
  extensionInfo: ExtensionInfo | null;
}
