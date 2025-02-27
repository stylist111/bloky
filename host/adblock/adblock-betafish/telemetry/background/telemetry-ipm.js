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
/* global browser */

import * as logger from "../../utilities/background/logger.ts";

import { chromeStorageSetHelper } from "../../utilities/background/bg-functions";
import { clearEvents, executeIPMCommands, getPayload } from "../../ipm/background/index.ts";
import postData from "../../fetch-util";
import { Prefs } from "../../alias/prefs";
import ServerMessages from "../../servermessages";
import TelemetryBase from "./telemetry-base";
import { telemetryNotifier } from "./telemetry-ping";

class IPMTelemetry extends TelemetryBase {
  /**
   * Processes a response from the IPM server. Will request command execution
   * if necessary.
   *
   * @param response The response from the IPM server
   */
  static async processResponse(response) {
    if (!response || !response.ok) {
      const status = (response && response.status) || "no status";
      logger.error(`[Telemetry]: Bad response status from IPM server: ${status}`);
      return;
    }
    telemetryNotifier.emit("ipm.ping.complete");

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
      logger.error("[Telemetry]: Error parsing IPM response.", error);
    }
  }

  // Called just after we ping the server, to schedule our next ping.
  scheduleNextPing() {
    return new Promise(async (resolve) => {
      const response = await browser.storage.local.get(this.totalRequestsStorageKey);
      let totalPings = response[this.totalRequestsStorageKey];
      if (typeof totalPings !== "number" || Number.isNaN(totalPings)) {
        totalPings = 0;
      }
      totalPings += 1;
      chromeStorageSetHelper(this.totalRequestsStorageKey, totalPings);

      let delayHours;
      if (totalPings === 1) {
        // Ping one hour after install
        delayHours = 1;
      } else {
        // Then every day
        delayHours = 24;
      }
      const millis = 1000 * 60 * 60 * delayHours;
      let nextPingTime = Date.now() + millis;
      // The smear factor isn't added for the first ping
      // so that the first IPM ping is sent ASAP after installation
      if (totalPings >= 2) {
        const smear = Math.floor(Math.random() * 600000) + 60000;
        // add a random amount of time (between 1 minute and 11 minutes)
        // to the next ping time to avoid overloading the server
        // with requests at the same time every day
        nextPingTime += smear;
      }
      chromeStorageSetHelper(this.nextRequestTimeStorageKey, nextPingTime, (error) => {
        this.dataCorrupt = !!error;
        resolve();
      });
    });
  }

  async sendPingData(pingData) {
    if (Prefs.get("data_collection_opt_out")) {
      return;
    }

    // as we about to send all user events, we can delete them
    void clearEvents();
    const response = await postData(Prefs.get(this.hostURLPref), pingData).catch((error) => {
      logger.error("ipm ping error", error);
      ServerMessages.recordGeneralMessage("ipm_ping_error", undefined, { error });
    });
    IPMTelemetry.processResponse(response);
  }

  async pingNow() {
    const pingData = await getPayload();
    await this.sendPingData(pingData);
    return pingData;
  }
}

export default IPMTelemetry;
