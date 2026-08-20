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
 * This file contains the `start` that the ewe core needs to start up.
 */

import rulesIndex from "@eyeo/rules-utils/adblockplus/index/adblockplus.json";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import type {
  AddonInfo,
  FirstRunInfo
} from "@eyeo/webext-ad-filtering-solution";

import { getFacts } from "~/remote-config/background";
import { info } from "~/info/background";

const addonInfo: AddonInfo = {
  bundledSubscriptions: rulesIndex,
  bundledSubscriptionsPath: "/data/rules/abp",
  heavyDependenciesPath:
    "/vendor/@eyeo/webext-ad-filtering-solution/heavy-dependencies.js",
  name: info.addonName,
  version: info.addonVersion,
  remoteConfig: {
    url: "https://easylist-downloads.adblockplus.org/ab-testing/experiments.json",
    getFacts,
    rulesIndex
  },
  account: {
    apiBaseUrl: "https://api.ua.eyeo.it/v1",
    loginRequestPattern:
      "https://myaccount.adblockplus.org/api/auth/ext-login*",
    applicationId: "8aac1ab7a162dc3c81f1574281f3aecc"
  }
};

/**
 * Starts the EWE with the addon information.
 *
 * @returns A promise that is resolved after starting up is completed.
 */

export async function start(): Promise<FirstRunInfo> {
  const cdp = {
    pingUrl: webpackDotenvPlugin.CDP_PING_URL,
    publicKeyUrl: webpackDotenvPlugin.CDP_PUBLIC_KEY_URL,
    bearer: webpackDotenvPlugin.CDP_BEARER
  };

  if (cdp.pingUrl && cdp.publicKeyUrl && cdp.bearer) {
    addonInfo.cdp = cdp;
  }

  const telemetry = {
    url: webpackDotenvPlugin.EYEOMETRY_URL,
    bearer: webpackDotenvPlugin.EYEOMETRY_BEARER
  };

  if (telemetry.url && telemetry.bearer) {
    addonInfo.telemetry = telemetry;
  }

  const telemetryEventLogging = {
    url: webpackDotenvPlugin.EYEOMETRY_EVENT_LOGGING_URL,
    bearer: webpackDotenvPlugin.EYEOMETRY_EVENT_LOGGING_BEARER
  };

  if (telemetryEventLogging.url && telemetryEventLogging.bearer) {
    addonInfo.telemetryEventLogging = telemetryEventLogging;
  }

  const firstRun = await ewe.start(addonInfo);
  return firstRun;
}
