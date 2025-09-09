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

/* For ESLint: List any global identifiers used in this file below */
/* global browser  */

import { getDebugInformation } from "@eyeo-fragments/debug-information/background";

import { Prefs } from "~/alias/prefs";
import { getUserId } from "~/id/background/index";
import { adblockIsPaused } from "../../../src/pause/background/index";
import { License, channels } from "~/picreplacement/check";
import { getSettings, settings } from "~/prefs/background";

import { PING_COUNT_STORAGE_KEY } from "./constants";

const getDebugLicenseInfo = async () => {
  await License.ready();
  const response = {};
  response.licenseInfo = {};
  response.licenseInfo.extensionGUID = await getUserId();
  response.licenseInfo.licenseId = License.get() && License.get().licenseId;
  response.licenseInfo.licenseState = License.get() && License.get().status;
  response.licenseInfo.licenseVersion = License.get() && License.get().lv;
  response["License Installation Date"] = await License.getLicenseInstallationDate();
  const customChannelId = channels.getIdByName("CustomChannel");
  if (
    customChannelId &&
    channels.getGuide()[customChannelId] &&
    channels.getGuide()[customChannelId].enabled
  ) {
    const customChannel = channels.channelGuide[customChannelId].channel;
    const result = await customChannel.getTotalBytesInUse();
    response["Custom Channel total bytes in use"] = result;
  }
  return response;
};

const getTotalPings = async function () {
  const storageResponse = await browser.storage.local.get(PING_COUNT_STORAGE_KEY);
  const response = storageResponse[PING_COUNT_STORAGE_KEY] || 0;
  return response;
};

// Get debug info as a JSON object for bug reporting and ad reporting
export const getDebugInfo = async function () {
  await Promise.all([Prefs.untilLoaded, License.ready(), settings.onload()]);
  const [userSettings, pingCount, isAdblockIsPaused] = await Promise.all([
    getSettings(),
    getTotalPings(),
    adblockIsPaused(),
  ]);
  const [prefs, licenseInformation] = await Promise.all([Prefs.toJSON(), getDebugLicenseInfo()]);
  const additionalHostSpecificInformation = {
    userSettings,
    pingCount,
    isAdblockIsPaused,
  };
  return getDebugInformation({
    additionalHostSpecificInformation,
    licenseInformation,
    prefs,
  });
};
