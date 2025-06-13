/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";

import { executeIPMCommands } from "./command-library";
import { clearEvents, getPayload } from "./data-collection";
import { type PayloadData } from "./data-collection.types";
import { getStartInfo } from "./start-info";
import {
  intervalKey,
  lastPingKey,
  pingCountPrefsKey,
  scheduleName,
  serverUrlKey,
} from "./telemetry.types";

/**
 * Processes a response from the IPM server. Will request command execution
 * if necessary.
 *
 * @param response The response from the IPM server
 */
async function processResponse(response: Response): Promise<void> {
  const { logger } = getStartInfo();

  if (!response || !response.ok) {
    const status = response?.status || "no status";
    logger.reportAndLogError(
      new Error(`Bad response status from IPM server: ${status}`),
      `[Telemetry]: Bad response status from IPM server: ${status}`,
    );
    return;
  }

  // If the server responded with an empty body, we're done here.
  const body = await response.text();
  if (body.length === 0) {
    return;
  }

  // If the server responded with anything else, we assume it's a command or a list of them.
  try {
    const bodyJSON = JSON.parse(body);
    let commands;

    if (Array.isArray(bodyJSON)) {
      commands = bodyJSON;
    } else {
      // adding support to legacy server response, where we receive only one command per ping
      commands = [bodyJSON];
    }

    await executeIPMCommands(commands);
  } catch (error) {
    logger.reportAndLogError(
      error as Error,
      "[Telemetry]: Error parsing IPM response.",
    );
  }
}

/**
 * Increments the number of total IPM pings.
 */
function incrementPingCount(): void {
  const { prefs } = getStartInfo();

  const count = prefs.get(pingCountPrefsKey);
  void prefs.set(pingCountPrefsKey, count + 1);
}

/**
 * Sends a ping together with telemetry data
 *
 * @returns request payload (null, if no ping was attempted)
 */
export async function sendPing(): Promise<PayloadData | null> {
  const { isOptedOut, logger, prefs } = getStartInfo();

  // Disable IPM when user opted out of data collection.
  if (await isOptedOut()) {
    return null;
  }

  // Check if enough time has passed to actually ping
  const lastPingTimestamp = prefs.get(lastPingKey);
  const intervalTime = prefs.get(intervalKey);
  if (Date.now() - lastPingTimestamp < intervalTime) {
    // We haven't reached our desired interval time yet.
    logger.warn("[Telemetry]: Ping time too early, not pinging.");
    return null;
  }

  const payload = await getPayload();

  // We're deleting user events regardless of whether sending them will be
  // successful or not.
  void clearEvents();

  const url = prefs.get(serverUrlKey);
  if (typeof url !== "string") {
    return null;
  }

  // Update ping count and timestamp for latest ping
  void prefs.set(lastPingKey, Date.now());
  incrementPingCount();

  void fetch(url, {
    method: "POST",
    cache: "no-cache",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(processResponse)
    .catch((error) => {
      logger.reportAndLogError(
        error as Error,
        "[Telemetry]: Ping sending failed with error:",
      );
    });

  return payload;
}

/**
 * Gets the number of IPM pings from storage.
 *
 * @returns The IPM ping count
 */
export async function getIPMPingCount(): Promise<number> {
  const { prefs } = getStartInfo();

  await prefs.untilLoaded;
  return prefs.get(pingCountPrefsKey);
}

/**
 * Starts The telemetry module.
 *
 * Will schedule pings.
 */
export async function start(): Promise<void> {
  const { addMessageListener, prefs } = getStartInfo();

  addMessageListener("ipm:testing.ping_ipm_server", async () => {
    return await sendPing();
  });

  await prefs.untilLoaded;
  const intervalTime = prefs.get(intervalKey);
  if (typeof intervalTime !== "number") {
    return;
  }

  browser.alarms.onAlarm.addListener((alarm: browser.Alarms.Alarm) => {
    if (alarm.name !== scheduleName) {
      return;
    }
    void sendPing();
  });

  browser.alarms.create(scheduleName, {
    periodInMinutes: intervalTime / 1000 / 60,
  });

  void sendPing();
}
