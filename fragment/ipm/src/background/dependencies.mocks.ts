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
 * This file contains test doubles for the IPM fragment's dependencies.
 */

import {
  type Dependencies,
  type getExperimentsFunction,
  type Licensing,
  type Logger,
  type Preferences,
  type UserAndHostInformation,
} from "./dependencies.types";

const prefs: Preferences = {
  get(_): any {
    return null;
  },
  async set(_key, _value) {},
  on(_pref, _callback) {},

  untilLoaded: Promise.resolve(),
};

const logger: Logger = {
  debug(_) {},
  reportAndLogError(_e, _logContext) {},
};

const licensing: Licensing = {
  isLicenseValid() {
    return false;
  },
};

const info: UserAndHostInformation = {
  async getId() {
    return "";
  },
  getAppName() {
    return "app_name";
  },
  getBrowserName() {
    return "browser_name";
  },
  getBrowserVersion() {
    return "browser_version";
  },
  getAppVersion() {
    return "app_version";
  },
};

const getExperiments: getExperimentsFunction = async (): Promise<string> => "";

export function getDependencies(): Dependencies {
  return {
    prefs,
    logger,
    licensing,
    info,
    getExperiments,
  };
}
