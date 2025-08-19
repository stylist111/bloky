/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import ipmScenarios from "../ipm-scenarios.js";
import { getExpiryDate } from "./utils.js";

export async function getResponseDataForCommand(scenarioId) {
  let statusCode = 200;
  let bodyData;

  if (scenarioId in ipmScenarios) {
    bodyData = ipmScenarios[scenarioId];
  }

  if (statusCode === 200 && Array.isArray(bodyData)) {
    for (const command of bodyData) {
      if (!("expiry" in command)) {
        command.expiry = getExpiryDate(1);
      }
    }
  }
  return { statusCode, body: JSON.stringify(bodyData) };
}

export function getResponseData(singleObjectMode = false) {
  // Default status code for any response should be 200.
  // Specific error cases may change this default value.
  let statusCode = 200;
  let bodyData;

  // providing legacy command server response as a single object
  if (singleObjectMode && Array.isArray(bodyData)) {
    if (bodyData.length > 1) {
      // multiple command response is not compatible in legacy mode
      statusCode = 401;
      bodyData = {
        message: "unknown device ID",
      };
    } else {
      bodyData = bodyData[0];
    }
  }
  const body = JSON.stringify(bodyData);
  return { statusCode, body };
}
