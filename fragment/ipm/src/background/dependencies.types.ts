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
 * An interface describing the dependencies of the IPM fragment.
 */
export interface Dependencies {
  prefs: Preferences;
  logger: Logger;
  licensing: Licensing;
  info: UserAndHostInformation;
  getExperiments: getExperimentsFunction;
}

export interface Preferences {
  get: (preference: string) => any;
  set: (preference: string, value: any) => Promise<void>;
  on: (preference: string, callback: () => Promise<void>) => void;

  untilLoaded: Promise<void>;
}

export interface Logger {
  debug: (...data: unknown[]) => void;
  reportAndLogError: (e: Error, logContext?: string) => void;
}

export interface Licensing {
  isLicenseValid: () => boolean;
}

export interface UserAndHostInformation {
  getId: () => Promise<string>;
  getAppName: () => string;
  getBrowserName: () => string;
  getBrowserVersion: () => string;
  getAppVersion: () => string;
}

/**
 * Function signature of the host's getExperiments(), as of 2025-02-05
 */
export type getExperimentsFunction = () => Promise<string>;
