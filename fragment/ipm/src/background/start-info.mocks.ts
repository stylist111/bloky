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
 * This file contains mocks for the IPM fragment's start info.
 */

import { type StartInfo } from "./start-info.types";

const prefs = {
  get(_: string) {},
  async set(_key: string, _value: any) {},
  untilLoaded: Promise.resolve(),
};

const logger = {
  debug(..._data: unknown[]) {},
  reportAndLogError(_e: Error, _logContext?: string) {},
};

const licensing = {
  isLicenseValid() {
    return false;
  },
};

const info = {
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

const getExperiments = async (): Promise<string> => "";

export function getStartInfo(): StartInfo {
  return {
    prefs,
    logger,
    licensing,
    info,
    getExperiments,
  };
}
