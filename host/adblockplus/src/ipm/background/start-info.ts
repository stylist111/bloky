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
 * This file contains the `StartInfo` that the IPM fragment needs to start up.
 */

import { port } from "~/core/messaging/background";
import { getInstallationId } from "~/id/background";
import { info } from "~/info/background";
import * as logger from "~/logger/background";
import { getPremiumState } from "~/premium/background";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getBlockCount } from "./block-count";
import { type StartInfo } from "./fragment-provider.types";

/**
 * The information the IPM fragments needs to start up.
 */
export const startInfo: StartInfo = {
  prefs: Prefs,
  logger,
  licensing: {
    async isLicenseValid() {
      await Prefs.untilLoaded;
      const { isActive } = getPremiumState();
      return isActive;
    }
  },
  info: {
    async getId() {
      return await getInstallationId();
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
    }
  },
  addMessageListener(name, listener) {
    port.on(name, listener);
  },
  removeMessageListener(name, listener) {
    port.off(name, listener);
  },
  getBlockCount,
  async isOptedOut() {
    await Prefs.untilLoaded;
    return Prefs.get("data_collection_opt_out") === true;
  }
};
