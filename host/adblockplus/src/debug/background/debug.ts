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
  getDebugInformation,
  type DebugInfoResponse
} from "@eyeo-fragments/debug-information/background";
import { type PremiumInformation } from "./debug.types";
import { getInstallationId } from "../../id/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getPremiumState } from "../../premium/background";
import {
  type MessageSender,
  addTrustedMessageTypes,
  port
} from "../../core/messaging/background";
import { type Message } from "~/core/messaging/shared";

/**
 * Returns the Premium information to be included in the debug data
 *
 * @returns The Premium Information
 */
const getDebugLicenseInfo = async (): Promise<PremiumInformation> => {
  const [isActive, installationId] = await Promise.all([
    getPremiumState().isActive,
    getInstallationId()
  ]);
  return { isActive, installationId };
};

/**
 * Returns the debug data as a JSON serializable object
 *
 * @returns The Debug Information
 */
export const getDebugInfo = async function (): Promise<DebugInfoResponse> {
  await Prefs.untilLoaded;
  const prefs = Prefs.toJSON();
  const licenseInformation = await getDebugLicenseInfo();
  return await getDebugInformation({
    licenseInformation,
    prefs
  });
};

/**
 * Handles the debug.getDebugInfo message
 *
 * @param message - The message to handle
 * @param sender - The message sender
 *
 * @returns The payload and extension info
 */
async function handleGetDebugInfoMessage(
  message: Message,
  sender: MessageSender
): Promise<DebugInfoResponse | null> {
  return await getDebugInfo();
}

/**
 * Initializes the getDebugData module
 */
export function start(): void {
  port.on("debug.getDebugInfo", handleGetDebugInfoMessage);
  addTrustedMessageTypes(null, ["debug.getDebugInfo"]);
}
