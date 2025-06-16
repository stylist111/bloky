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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { log, determineUserLanguage, getUserAgentInfo } from "./utilities/background/index";
import { getUserId } from "./id/background/index";
import { Prefs } from "~/alias/prefs";

async function getExperimentsAssignments() {
  const assignments = await ewe.experiments.getAssignments();
  return Object.entries(assignments).map((assignment) => {
    return {
      experiment_id: assignment[0],
      variant_id: assignment[1],
    };
  });
}

// Log an 'error' message on GAB log server.
const ServerMessages = (function serverMessages() {
  const { flavor } = getUserAgentInfo();
  const { os } = getUserAgentInfo();
  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const sendMessageToLogServer = async function (payload, callback) {
    if (Prefs.get("data_collection_opt_out")) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return fetch("https://log.getadblock.com/v2/record_log.php", {
      method: "POST",
      cache: "no-cache",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(() => {
        if (typeof callback === "function") {
          callback();
        }
      })
      .catch((error) => {
        log("message server returned error: ", error);
      });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const recordMessageWithUserID = async function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }
    const payload = {
      u: await getUserId(),
      f: flavor,
      o: os,
      l: determineUserLanguage(),
      t: queryType,
      v: browser.runtime.getManifest().version,
      experiments: await getExperimentsAssignments(),
    };
    if (typeof additionalParams === "object") {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    // eslint-disable-next-line consistent-return
    return sendMessageToLogServer(eventWithPayload, callback);
  };

  // Log a message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  const recordAnonymousMessage = function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }
    const payload = {
      f: flavor,
      o: os,
      l: determineUserLanguage(),
      t: queryType,
    };
    if (typeof additionalParams === "object") {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  // Log a error message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  const recordAnonymousErrorMessage = function (msg, callback, additionalParams) {
    if (!msg) {
      return;
    }
    const payload = {
      f: flavor,
      o: os,
      l: determineUserLanguage(),
      t: "error",
    };
    if (typeof additionalParams === "object") {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  const recordErrorMessage = function (msg, additionalParams, callback) {
    void recordMessageWithUserID(msg, "error", callback, additionalParams);
  };

  // Log an 'status' related message on GAB log server.
  const recordStatusMessage = function (msg, callback, additionalParams) {
    void recordMessageWithUserID(msg, "stats", callback, additionalParams);
  };

  // Log a 'general' message on GAB log server.
  const recordGeneralMessage = function (msg, callback, additionalParams) {
    void recordMessageWithUserID(msg, "general", callback, additionalParams);
  };

  // Log an ad wall specific 'general' message on GAB log server.
  const recordAdWallMessage = function (msg, additionalParams) {
    if (Prefs.get("send_ad_wall_messages")) {
      void recordMessageWithUserID(msg, "general", null, additionalParams);
    }
  };

  // Log a 'adreport' message on GAB log server.
  const recordAdreportMessage = function (msg, callback, additionalParams) {
    void recordMessageWithUserID(msg, "adreport", callback, additionalParams);
  };

  // Log a data-collection opt-out message on GAB log server.
  const recordOptOutMessage = async function () {
    return recordMessageWithUserID("data_collection_opt_out", "general");
  };

  // Log a data-collection smart allowlist expired message on GAB log server.
  const recordAllowlistEvent = async function (eventName, allowlistDuration) {
    return recordGeneralMessage(eventName, null, { allowlistDuration });
  };

  return {
    recordAdreportMessage,
    recordAdWallMessage,
    recordAnonymousMessage,
    recordAnonymousErrorMessage,
    recordErrorMessage,
    recordGeneralMessage,
    recordStatusMessage,
    recordOptOutMessage,
    recordAllowlistEvent,
  };
})();

export default ServerMessages;
