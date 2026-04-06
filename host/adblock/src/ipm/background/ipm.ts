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

import {
  type StartInfo,
  start as startFragment,
} from "@eyeo-fragments/in-product-messaging/background";

import * as info from "info";

import { Prefs } from "~/alias/prefs";
import { getUserId } from "~/id/background";
import * as utils from "~/utilities/background";

import { port } from "../../../adblockplusui/adblockpluschrome/lib/messaging/port";
import { getBlockCount } from "./block-count";

const startInfo: StartInfo = {
  logger: utils,
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
  },
};

/**
 * Initializes in-product messaging functionality
 */
export async function start(): Promise<void> {
  await Prefs.untilLoaded;

  await startFragment(startInfo);
}
