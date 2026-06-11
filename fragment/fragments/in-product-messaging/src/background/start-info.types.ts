/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
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
 * An interface describing the start info for the IPM fragment.
 */
export interface StartInfo {
  logger: Logger;
  info: UserAndHostInformation;
  getBlockCount: () => Promise<number>;
  isOptedOut: () => Promise<boolean>;
  getDefaultOrigin: () => string;
  getSafeOrigins: () => string[];
  getDismissedIpmIds: () => string[];
  setDismissedIpmIds: (ipmIds: string[]) => void;
  addMessageListener: (
    name: string,
    listener: (message: unknown) => unknown,
  ) => void;
  removeMessageListener: (
    name: string,
    listener: (message: unknown) => unknown,
  ) => void;
  getLastSyncId: () => string | null;
  setLastSyncId: (syncId: string | null) => void;
}

interface Logger {
  debug: (...data: unknown[]) => void;
  reportAndLogError: (e: Error, logContext?: string) => void;
  warn: (...data: unknown[]) => void;
}

interface UserAndHostInformation {
  getId: () => Promise<string>;
  getAppName: () => string;
  getBrowserName: () => string;
  getBrowserVersion: () => string;
  getAppVersion: () => string;
}
