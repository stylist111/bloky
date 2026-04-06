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

import {
  type StartInfo,
  start as startFragment
} from "@eyeo-fragments/in-product-messaging/background";

import { port } from "~/core/messaging/background";
import { getInstallationId } from "~/id/background";
import { info } from "~/info/background";
import * as logger from "~/logger/background";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getBlockCount } from "./block-count";

const startInfo: StartInfo = {
  logger,
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
  getDismissedIpmIds() {
    return Prefs.get("ipm:dismissed_ipm_ids");
  },
  setDismissedIpmIds(ipmIds) {
    void Prefs.set("ipm:dismissed_ipm_ids", ipmIds);
  },
  addMessageListener(name, listener) {
    port.on(name, listener);
  },
  removeMessageListener(name, listener) {
    port.off(name, listener);
  },
  getLastSyncId() {
    return Prefs.get("ipm:last_sync_id");
  },
  setLastSyncId(syncId) {
    void Prefs.set("ipm:last_sync_id", syncId);
  }
};

/**
 * Initializes in-product messaging functionality
 */
export async function start(): Promise<void> {
  await Prefs.untilLoaded;

  startFragment(startInfo);
}
