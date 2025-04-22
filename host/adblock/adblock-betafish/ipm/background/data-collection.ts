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

import * as info from "info";
import * as browser from "webextension-polyfill";

import { getStoredCommandIds } from "./command-library";
import { CommandName, CommandVersion } from "./command-library.types";
import {
  BaseAttributes,
  DataType,
  DeviceData,
  EventData,
  IpmCapability,
  IpmData,
  eventStorageKey,
  LicenseState,
  PayloadData,
  PlatformStatus,
  PlatformType,
  UserData,
  pingCountStorageKey,
} from "./data-collection.types";
import { getUserId } from "../../id/background/index";
import { License } from "../../picreplacement/check";
import { Prefs } from "../../alias/prefs";

/**
 * Takes a number, turns it into a string, and pads it if necessary to create
 * a string of the length 2.
 *
 * @param value The number to pad
 * @returns The padded number
 */
function leftPad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Returns a string representing local time.
 *
 * @returns A string representing the local time
 */
function getLocalTime(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    "-",
    leftPad(date.getMonth() + 1),
    "-",
    leftPad(date.getDate()),
    "T",
    leftPad(date.getHours()),
    ":",
    leftPad(date.getMinutes()),
    ":",
    leftPad(date.getSeconds()),
  ].join("");
}

/**
 * Returns an object with base attributes that all MoEngage telemetry objects share.
 *
 * @returns The base attributes
 */
async function getBaseAttributes(): Promise<BaseAttributes> {
  return {
    app_name: info.baseName,
    browser_name: info.application,
    // Removing 0.0.0 from browser_version as can only get major version anyway:
    browser_version: info.applicationVersion.split(".").shift()!,
    os: (await browser.runtime.getPlatformInfo()).os,
    language_tag: browser.i18n.getUILanguage(),
    app_version: info.addonVersion,
    install_type: (await browser.management.getSelf()).installType,
    manifest_version: browser.runtime.getManifest().manifest_version,
  };
}

/**
 * Creates an object containing all data for an event that the IPM server expects.
 *
 * @param ipmId The IPM command id
 * @param commandName - The name of the command the event belongs to
 * @param commandVersion - The version of the command the event belongs to
 * @param name The event name
 * @returns A fully qualified event data object
 */
async function getEventData(
  ipmId: string,
  commandName: string,
  commandVersion: number,
  name: string,
): Promise<EventData> {
  return {
    type: DataType.event,
    device_id: await getUserId(),
    action: name,
    platform: PlatformType.web,
    app_version: info.addonVersion,
    user_time: getLocalTime(),
    attributes: {
      ...(await getBaseAttributes()),
      ipm_id: ipmId,
      command_name: commandName,
      command_version: commandVersion,
    },
  };
}

/**
 * Creates an object containing all device data that the IPM server expects.
 *
 * @returns An object containing device data
 */
async function getDeviceData(): Promise<DeviceData> {
  await Prefs.untilLoaded;
  return {
    type: DataType.device,
    device_id: await getUserId(),
    attributes: {
      ...(await getBaseAttributes()),
      extension_id: browser.runtime.id,
      blocked_total: (Prefs as any).blocked_total,
      license_status: License.isActiveLicense() ? LicenseState.active : LicenseState.inactive,
    },
  };
}

/**
 * Gets the number of IPM pings from storage.
 *
 * @returns The IPM ping count
 */
async function getIPMPingCount(): Promise<number> {
  const pingCountStorage = await browser.storage.local.get(pingCountStorageKey);
  const count = pingCountStorage[pingCountStorageKey];
  return typeof count === "number" && !Number.isNaN(count) ? count : 0;
}

/**
 * Creates an object containing all user data that the IPM server expects.
 *
 * @returns An object containing user data
 */
async function getUserData(): Promise<UserData> {
  return {
    type: DataType.customer,
    platforms: [{ platform: PlatformType.web, active: PlatformStatus.true }],
    attributes: {
      ...(await getBaseAttributes()),
      ping_count: await getIPMPingCount(),
    },
  };
}

/**
 * Gets commands data supported by the extension to send to the IPM server
 *
 * @returns a list of objects containing the supported commands data
 */
export function getSupportedCommandsData(): IpmCapability[] {
  const commandNames = Object.values(CommandName);
  const supportedCommandsData = commandNames.map((name) => ({
    name,
    version: CommandVersion[name],
  }));

  return supportedCommandsData;
}

/**
 * Gets IPM data in the extension that will be consumed by the IPM server.
 *
 * @returns an object containing the IPM data
 */
function getIpmData(): IpmData {
  return {
    active: getStoredCommandIds().map((id) => ({ id })),
    capabilities: [
      {
        name: "multi_ipm_response",
        version: 1,
      },
      ...getSupportedCommandsData(),
    ],
  };
}

/**
 * Creates the payload to send to the IPM server.
 *
 * @returns An object containing the payload
 */
export async function getPayload(): Promise<PayloadData> {
  await Prefs.untilLoaded;
  const user = await getUserData();
  const device = await getDeviceData();
  const events = Prefs.get(eventStorageKey);
  const ipm = getIpmData();
  return { user, device, events, ipm };
}

/**
 * Clears all recorded user events.
 */
export async function clearEvents(): Promise<void> {
  await Prefs.untilLoaded;
  Prefs.set(eventStorageKey, []);
}

/**
 * Generates and stores event data.
 *
 * **NOTE**: To record events, please do not use this function directly.
 * Instead refer to the functions provided in the event recording file.
 *
 * @param ipmId An ipm ID (or a replacement string)
 * @param commandName A command name (or a replacement string)
 * @param commandVersion A command version (or a replacement number)
 * @param name The name of the event to store
 */
export async function storeEvent(
  ipmId: string,
  commandName: string,
  commandVersion: number,
  name: string,
): Promise<void> {
  await Prefs.untilLoaded;
  const eventData = await getEventData(ipmId, commandName, commandVersion, name);
  const eventStorage = Prefs.get(eventStorageKey) as EventData[];
  eventStorage.push(eventData);
  void Prefs.set(eventStorageKey, eventStorage);
}
