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
 * A interface to capture are the needed external functionalities needed by
 * the IPM system to work. These functionalities are tipically implemented
 * by hosting extensions.
 */
export interface Context {
  // Preferences
  untilPreferencesLoaded: () => Promise<void>;
  getPreference: (key: string) => any;
  setPreference: (key: string, value: any) => Promise<void>;
  onPreferenceChanged: (key: string, f: () => Promise<void>) => void;

  // Logger
  logDebug: (...args: any[]) => void;
  logError: (...args: any[]) => void;

  // Licenses and Premium
  isLicenseValid: () => boolean;

  // User or Installation Id
  getId: () => Promise<string>;

  // Host information
  getAppName: () => string;
  getBrowserName: () => string;
  getAppVersion: () => string;
}

export interface Preferences {
  get: (preference: string) => any;
  set: (preference: string, value: any) => Promise<void>;
  on: (preference: string, callback: () => Promise<void>) => void;

  untilLoaded: Promise<void>;
}

export interface Logger {
  debug: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
}

export interface Licensing {
  isLicenseValid: () => boolean;
}

export interface UserAndHostInformation {
  getId: () => Promise<string>;
  getAppName: () => string;
  getBrowserName: () => string;
  getAppVersion: () => string;
}
