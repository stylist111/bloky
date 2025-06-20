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

import { type PayloadData } from "./data-collection.types";

/**
 * An interface describing the start info for the IPM fragment.
 */
export interface StartInfo {
  prefs: Preferences;
  logger: Logger;
  licensing: Licensing;
  info: UserAndHostInformation;
  addMessageListener: (
    name: string,
    listener: () => Promise<PayloadData | null>,
  ) => void;
  getBlockCount: () => Promise<number>;
  isOptedOut: () => Promise<boolean>;
}

interface Preferences {
  get: (preference: string) => any;
  set: (preference: string, value: any) => Promise<void>;
  untilLoaded: Promise<void>;
}

interface Logger {
  debug: (...data: unknown[]) => void;
  reportAndLogError: (e: Error, logContext?: string) => void;
  warn: (...data: unknown[]) => void;
}

interface Licensing {
  isLicenseValid: () => Promise<boolean>;
}

interface UserAndHostInformation {
  getId: () => Promise<string>;
  getAppName: () => string;
  getBrowserName: () => string;
  getBrowserVersion: () => string;
  getAppVersion: () => string;
}
