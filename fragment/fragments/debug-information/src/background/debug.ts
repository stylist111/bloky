/**
 * This file is part of eyeo's browser extension host
 * debug information fragment,
 * Copyright (C) 2025-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type {
  DebugInfoResponse,
  ExperimentsAssignments,
  HostSpecificInformation,
  MigrationErrors,
  RemoteConfigurationData,
  RuleMetaData,
  SubscriptionDetails,
  SubscriptionLedger,
  AlarmInfo,
  AccountInfo,
} from "./debug.types.js";
import { getUserAgentInfo } from "./user-agent-info";

import browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

const MILLIS_IN_SECOND = 1000;

async function getExperimentsAssignments(): Promise<ExperimentsAssignments> {
  const assignments = await ewe.experiments.getAssignments();
  return Object.entries(assignments).map(([experimentId, variantId]) => ({
    experimentId,
    variantId,
  }));
}

async function getExperimentData(): Promise<RemoteConfigurationData> {
  const experimentFlags = await ewe.experiments.getFlags();
  const experimentAssignments = await getExperimentsAssignments();
  return { experimentFlags, experimentAssignments };
}

async function getDebugAlarmInfo(): Promise<AlarmInfo> {
  const alarms = await browser.alarms.getAll();
  const alarmInfo: AlarmInfo = alarms.map((alarm) => ({
    name: alarm.name,
    time: new Date(alarm.scheduledTime).toISOString(),
  }));
  return alarmInfo;
}

async function getSubscriptionInfo(): Promise<SubscriptionDetails> {
  const subscriptions = await ewe.subscriptions.getSubscriptions();
  const response: SubscriptionDetails = subscriptions.map((sub) => {
    const subscription = {
      enabled: sub.enabled,
      title: sub.title,
      id: sub.id,
      lastSuccess: sub.lastSuccess
        ? new Date(sub.lastSuccess * MILLIS_IN_SECOND).toISOString()
        : "unknown",
      lastDownload: sub.lastDownload
        ? new Date(sub.lastDownload * MILLIS_IN_SECOND).toISOString()
        : "unknown",
      downloadStatus: sub.downloadStatus ?? "unknown",
      downloadCount: sub.downloadCount ?? -1,
    };
    return subscription;
  });
  return response;
}

async function getSubscriptionLedger(): Promise<SubscriptionLedger> {
  const entries = await ewe.subscriptions.getLedger();
  return entries.map(({ url, state, reason, ts }) => ({
    url,
    state,
    reason,
    time: new Date(ts).toISOString(),
  }));
}

async function getCustomFilterMetaData(): Promise<RuleMetaData[]> {
  const currentUserFilters = await ewe.filters.getUserFilters();
  if (!currentUserFilters.length) {
    return [];
  }
  const validRules = currentUserFilters.filter((rule) => rule?.text);
  return await Promise.all(
    validRules.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return metadata
        ? { ruleText: filter.text, metadata }
        : { ruleText: filter.text };
    }),
  );
}

async function getJavascriptErrors(): Promise<unknown> {
  const errorKey = "errorkey";
  const error = await browser.storage.local.get(errorKey);
  return error[errorKey] ?? "no JS error";
}

async function getMigrationMessages(): Promise<MigrationErrors> {
  const [filtersErrors, subscriptionsErrors] = await Promise.all([
    ewe.filters.getMigrationErrors(),
    ewe.subscriptions.getMigrationErrors(),
  ]);
  return {
    filtersErrors,
    subscriptionsErrors,
  };
}

/**
 * Returns the account information needed to debug potential issues
 */
async function getAccountInfo(): Promise<AccountInfo> {
  const [hasPremium, isLoggedIn, user, syncStatus, lastTokenUpdate] =
    await Promise.all([
      ewe.account.hasPremium(),
      ewe.account.isLoggedIn(),
      ewe.account.getProfile(),
      ewe.account.getProfileSyncStatus(),
      ewe.account.getLastTokenUpdate(),
    ]);

  return {
    hasPremium,
    isLoggedIn,
    user,
    syncStatus,
    lastTokenUpdate: lastTokenUpdate
      ? new Date(lastTokenUpdate).toISOString()
      : null,
  };
}

/**
 * Returns the following information in human readable JSON object that can be 'stringified'
 *  User agent info
 *  - Platform, including version
 *  - OS, including version
 *  General extension information, including
 *  - Name
 *  - Version
 *  - Host permissions
 *  User / device specific information, including
 *  - Alarm information
 *  - Cohort, Experiment, IPM & Logging information
 *  - Filter list subscriptions
 *  - Latest recorded change of each filter list subscription
 *  - Custom / user rules & metadata
 *  - Other preferences and settings
 *  - Premium license information
 *  - Other extension (host) specific information
 *  Any known JS errors
 */
export async function getDebugInformation(
  parameters: HostSpecificInformation,
): Promise<DebugInfoResponse> {
  const [
    account,
    alarmInformation,
    errors,
    hostPermissions,
    migrationErrors,
    remoteConfigurationInformation,
    subscriptions,
    subscriptionLedger,
    userFilters,
  ] = await Promise.all([
    getAccountInfo(),
    getDebugAlarmInfo(),
    getJavascriptErrors(),
    browser.permissions.getAll(),
    getMigrationMessages(),
    getExperimentData(),
    getSubscriptionInfo(),
    getSubscriptionLedger(),
    getCustomFilterMetaData(),
  ]);

  const manifest = browser.runtime.getManifest();
  const userAgentInfo = getUserAgentInfo();

  return {
    account,
    deviceSpecificInformation: {
      alarmInformation,
      remoteConfigurationInformation,
      subscriptions,
      subscriptionLedger,
      userFilters,
    },
    errors,
    extensionInformation: {
      extensionVersion: manifest.version,
      extensionID: browser.runtime.id,
      hostPermissions,
    },
    hostSpecificInformation: parameters,
    migrationErrors,
    platformInformation: {
      ...userAgentInfo,
    },
  };
}
