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

import * as info from "info";

import { Prefs } from "~/alias/prefs";
import { getUserId } from "~/id/background";
import { License } from "~/picreplacement/check";
import * as utils from "~/utilities/background";
import { port } from "../../../adblockplusui/adblockpluschrome/lib/messaging/port";
import { getBlockCount } from "./block-count";
import { type FutureFragment, type LegacyFragment } from "./fragment-provider.types";

/**
 * The information the future IPM fragment needs to start up.
 */
export async function getFutureStartInfo(): Promise<FutureFragment.StartInfo> {
  await Prefs.untilLoaded;

  return {
    logger: utils,
    licensing: {
      async isLicenseValid() {
        await License.ready();
        return License.isActiveLicense();
      },
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
    getBlockCount,
    async isOptedOut() {
      return Prefs.get("data_collection_opt_out") === true;
    },
    getDefaultOrigin() {
      return Prefs.get("ipm:default_origin");
    },
    getSafeOrigins() {
      return Prefs.get("ipm:safe_origins");
    },
    fetchCommands() {
      return Prefs.get("ipm:stored_commands");
    },
    async persistCommands(commands) {
      return await Prefs.set("ipm:stored_commands", commands);
    },
  };
}

/**
 * The information the legacy IPM fragments needs to start up.
 */
export const legacyStartInfo: LegacyFragment.StartInfo = {
  prefs: Prefs,
  logger: utils,
  licensing: {
    async isLicenseValid() {
      await License.ready();
      return License.isActiveLicense();
    },
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
  getBlockCount,
  async isOptedOut() {
    await Prefs.untilLoaded;
    return Prefs.get("data_collection_opt_out") === true;
  },
  addMessageListener(name, listener) {
    port.on(name, listener);
  },
  removeMessageListener(name, listener) {
    port.off(name, listener);
  },
};
