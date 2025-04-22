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

import browser from "webextension-polyfill";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import {
  hasSchedule,
  removeSchedule
} from "../../core/scheduled-event-emitter/background";
import { warn as logWarning, reportAndLogError } from "../../logger/background";
import {
  executeIPMCommands,
  getPayload,
  clearEvents
} from "@eyeo-fragments/ipm/background";
import {
  intervalKey,
  lastPingKey,
  pingCountPrefsKey,
  scheduleName,
  serverUrlKey
} from "./telemetry.types";

/**
 * Processes a response from the IPM server. Will request command execution
 * if necessary.
 *
 * @param response The response from the IPM server
 */
async function processResponse(response: Response): Promise<void> {
  if (!response || !response.ok) {
    const status = response?.status || "no status";
    reportAndLogError(
      new Error(`Bad response status from IPM server: ${status}`),
      `[Telemetry]: Bad response status from IPM server: ${status}`
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
    reportAndLogError(
      error as Error,
      "[Telemetry]: Error parsing IPM response."
    );
  }
}

/**
 * Increments the number of total IPM pings.
 */
function incrementPingCount(): void {
  const count = Prefs.get(pingCountPrefsKey);
  void Prefs.set(pingCountPrefsKey, count + 1);
}

/**
 * Sends a ping together with telemetry data
 */
export async function sendPing(): Promise<void> {
  // Disable IPM when user opted out of data collection.
  if (Prefs.get("data_collection_opt_out") === true) {
    return;
  }

  // Check if enough time has passed to actually ping
  const lastPingTimestamp = Prefs.get(lastPingKey);
  const intervalTime = Prefs.get(intervalKey);
  if (Date.now() - lastPingTimestamp < intervalTime) {
    // We haven't reached our desired interval time yet.
    logWarning("[Telemetry]: Ping time too early, not pinging.");
    return;
  }

  const payload = await getPayload();

  // We're deleting user events regardless of whether sending them will be
  // successful or not.
  void clearEvents();

  const url = Prefs.get(serverUrlKey);
  if (typeof url !== "string") {
    return;
  }

  // Update ping count and timestamp for latest ping
  void Prefs.set(lastPingKey, Date.now());
  incrementPingCount();

  void fetch(url, {
    method: "POST",
    cache: "no-cache",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(processResponse)
    .catch((error) => {
      reportAndLogError(
        error as Error,
        "[Telemetry]: Ping sending failed with error:"
      );
    });
}

/**
 * Starts The telemetry module.
 *
 * Will schedule pings.
 */
export async function start(): Promise<void> {
  // We used to use the ScheduledEventEmitter for scheduling pings, so let's
  // clean up in case this is the first time we get here after changing that.
  if (hasSchedule(scheduleName)) {
    void removeSchedule(scheduleName);
  }

  await Prefs.untilLoaded;
  const intervalTime = Prefs.get(intervalKey);
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
    periodInMinutes: intervalTime / 1000 / 60
  });

  void sendPing();
}
