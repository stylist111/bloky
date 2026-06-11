/**
 * This file is part of eyeo's Conflict Detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

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

import browser from "webextension-polyfill";
import {
  alarmName,
  intervalKey,
  lastPingKey,
  PartnerExtensionIds,
  type PingResponse,
  PingMessage,
  type StartInfo,
} from "./detection.types.js";

/**
 * Sends a ping message to all known extensions
 *
 * @returns an array of found extension IDs
 */
export async function sendPingToParterExtension(): Promise<string[]> {
  const promises: Array<Promise<boolean>> = [];
  const foundExtensionIds: string[] = [];
  for (const extensionId of PartnerExtensionIds) {
    const response = browser.runtime
      .sendMessage(extensionId, PingMessage, undefined)
      .then((result: any) => {
        const pingResult = result as PingResponse;
        if (pingResult?.pingResponse) {
          foundExtensionIds.push(extensionId);
        }
        return !!pingResult?.pingResponse;
      })
      .catch(() => {
        return false;
      });
    promises.push(response);
  }
  await Promise.all(promises);
  return foundExtensionIds;
}

/**
 * Send, then save the responses from the ping messages to other extensions
 */
export async function sendSavePingResponses(
  parameters: StartInfo,
): Promise<void> {
  await parameters?.prefs.untilLoaded;
  // Check if enough time has passed to actually ping
  const lastPingTimestamp = parameters?.prefs.get(lastPingKey);
  const intervalTime = parameters?.prefs.get(intervalKey);
  if (Date.now() - lastPingTimestamp < intervalTime) {
    // We haven't reached our desired interval time yet.
    parameters?.logger.debug(
      "[conflict-detection]: Ping time too early, not pinging.",
    );
    return;
  }
  parameters?.logger.debug("[conflict-detection]: pinging.");
  const foundExtensionIds = await sendPingToParterExtension();
  await parameters.onUpdatedPartnerExtensionIds(foundExtensionIds);

  // Update the timestamp for latest ping
  await parameters?.prefs.set(lastPingKey, Date.now());
  parameters?.logger.debug(
    `[conflict-detection]: foundExtensionIds : ${foundExtensionIds.toString()}`,
  );
}

/**
 * Adds the Alarm listener to send a ping message to the other extensions
 */
export async function addAlarmListener(parameters: StartInfo): Promise<void> {
  browser.alarms.onAlarm.addListener((alarm: browser.Alarms.Alarm) => {
    if (alarm.name !== alarmName) {
      return;
    }
    void sendSavePingResponses(parameters);
  });
}

/**
 * Listens for messages from other extensions
 * Responds only if the extension ID is recognized
 */
function addMessageListener(): void {
  browser.runtime.onMessageExternal.addListener(function (
    message: unknown,
    sender,
    sendResponse: any,
  ) {
    if (!isMessage(message) || !isKnownSender(sender)) {
      return;
    }
    sendResponse({ pingResponse: true });
    return true;
  });
}

/**
 * Initializes the partner detection functionality of the fragment.
 */
export async function start(parameters: StartInfo): Promise<void> {
  void addAlarmListener(parameters);
  addMessageListener();

  await parameters?.prefs.untilLoaded;

  const intervalTime = parameters.prefs.get(intervalKey);

  if (typeof intervalTime !== "number") {
    parameters?.logger.debug(
      "[conflict-detection]: no intervalKey found in Prefs",
    );

    return;
  }
  const partnerAlarm = await browser.alarms.get(alarmName);

  if (partnerAlarm) {
    // No need to create the alarm again
    parameters?.logger.debug(
      `[conflict-detection]: alarm found, scheduled for ${new Date(partnerAlarm.scheduledTime).toLocaleString()}`,
    );
    return;
  }
  browser.alarms.create(alarmName, {
    periodInMinutes: intervalTime / 1000 / 60, // ping other extensions once a day
  });

  void sendSavePingResponses(parameters);
}

/**
 * Checks whether given Message is a PingMessage
 *
 * @param msg - Message
 *
 * @returns whether msg is a PingMessage
 */
function isMessage(candidate: unknown): candidate is typeof PingMessage {
  return (
    candidate !== null && typeof candidate === "object" && "type" in candidate
  );
}

/**
 * Checks whether a sender is from a known extension
 *
 * @param sender - MessageSender
 *
 * @returns whether sender is a known extension
 */
function isKnownSender(sender: browser.Runtime.MessageSender): boolean {
  return (
    typeof sender?.id === "string" &&
    PartnerExtensionIds.includes(
      sender.id as (typeof PartnerExtensionIds)[number],
    )
  );
}
