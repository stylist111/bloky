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
import type * as ewe from "@eyeo/webext-ad-filtering-solution";
import type browser from "webextension-polyfill";

/**
 * The debug data (summary) for a filter list subscription
 */
export type SubscriptionDetails = Array<{
  downloadCount: number;
  downloadStatus: string;
  enabled: boolean;
  id: string;
  lastDownload: string;
  lastSuccess: string;
  title: string;
}>;

/**
 * The latest recorded change of each filter list subscription, including
 * subscriptions that have since been removed
 */
export type SubscriptionLedger = Array<{
  reason: string;
  state: string;
  time: string;
  url: string;
}>;

/**
 * The debug data (summary) for extension alarms
 */
export type AlarmInfo = Array<{
  name: string;
  time: string;
}>;

/**
 * The debug data of experiment and variant information
 */
export type ExperimentsAssignments = Array<{
  experimentId: string;
  variantId: string;
}>;

/**
 * The debug data for the remote configuration data
 */
export interface RemoteConfigurationData {
  experimentAssignments: ExperimentsAssignments;
  experimentFlags: Record<string, unknown>;
}

/**
 * The debug data related to custom / user filters, and
 * related rule metadata
 */
export interface RuleMetaData {
  ruleText: string;
  metadata?: ewe.FilterMetadata | null | undefined;
}

/**
 * The debug data related to the platform the extension is installed in
 */
export interface PlatformInformation {
  browserName: string;
  browserVersion: string;
  osVersion: string;
  os: string;
}

/**
 * The debug data related to the extension
 */
export interface ExtensionInformation {
  extensionVersion: string;
  extensionID: string;
  hostPermissions: browser.Permissions.AnyPermissions | undefined;
}

/**
 * The debug data related to any errors that were encounter when migrating
 * the device from MV2 to MV3
 */
export interface MigrationErrors {
  filtersErrors?: any;
  subscriptionsErrors?: any;
}

/**
 * A container object for device specific debug data
 */
export interface DeviceSpecificInformation {
  alarmInformation: AlarmInfo;
  otherInfo?: any;
  remoteConfigurationInformation: RemoteConfigurationData;
  subscriptions?: SubscriptionDetails;
  subscriptionLedger?: SubscriptionLedger;
  userFilters?: RuleMetaData[];
}

/**
 * A container object for account related debug data
 */
export interface AccountInfo {
  hasPremium: boolean;
  isLoggedIn: boolean;
  user?: ewe.UserProfile | null;
  syncStatus?: ewe.ProfileSyncStatus | null;
  lastTokenUpdate: string | null;
}

/**
 * A container object for debug data
 */
export interface DebugInfoResponse {
  account: AccountInfo;
  deviceSpecificInformation: DeviceSpecificInformation;
  errors: unknown;
  hostSpecificInformation: HostSpecificInformation;
  platformInformation: PlatformInformation;
  extensionInformation: ExtensionInformation;
  migrationErrors?: MigrationErrors;
}

/**
 * A container object for host specific data
 */
export interface HostSpecificInformation {
  additionalHostSpecificInformation?: object;
  prefs?: Record<string, unknown>;
  licenseInformation?: object;
}

/**
 * Interface for the debug infomation fragment
 */
export interface GetInfo {
  /**
   * An object containing host specific debug data
   */
  hostSpecificInformation: HostSpecificInformation;
}
