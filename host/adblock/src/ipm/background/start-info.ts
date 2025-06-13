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
 * This file contains the `StartInfo` that the IPM fragment needs to start up.
 */

import { type StartInfo } from "@eyeo-fragments/ipm/background";

import * as info from "info";

import { port } from "../../../adblockplusui/adblockpluschrome/lib/messaging/port";
import { Prefs } from "~/alias/prefs";
import { getExperiments } from "~/alias/uninstall";
import { getUserId } from "~/id/background";
import { License } from "~/picreplacement/check";
import * as utils from "~/utilities/background";
import { getBlockCount } from "./block-count";

/**
 * The information the IPM fragments needs to start up.
 */
export const startInfo: StartInfo = {
  addMessageListener(name, listener) {
    port.on(name, listener);
  },
  getExperiments,
  getBlockCount,
  async isOptedOut() {
    await Prefs.untilLoaded;
    return Prefs.get("data_collection_opt_out") === true;
  },
  info: {
    async getId() {
      return await getUserId();
    },
    getAppName() {
      return info.baseName;
    },
    getAppVersion() {
      return info.addonVersion;
    },
    getBrowserName() {
      return info.application;
    },
    getBrowserVersion() {
      return info.applicationVersion;
    },
  },
  licensing: {
    async isLicenseValid() {
      await License.ready();
      return License.isActiveLicense();
    },
  },
  logger: utils,
  prefs: Prefs,
};
