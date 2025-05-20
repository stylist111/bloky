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

import { commandVersionByName, CREATE_ON_PAGE_DIALOG } from "./supported-commands.js";

/**
 * Generates a list of a specific amount of OPD commands
 *
 * @param {number} amountOfDialogs - Amount of commands that will be generated
 * @param {string} userId - Server user identifier
 * @returns {Array<Object>} An array of commands
 */
export function getOPDCommands(amountOfDialogs, userId, expired = false) {
  if (amountOfDialogs <= 0) {
    throw new Error("The amount of dialogs to generate should be greater than zero.");
  }

  if (!userId) {
    userId = "multipleOPDcommands";
  }

  const baseCommand = {
    command_name: "create_on_page_dialog",
    timing: "after_navigation",
    version: commandVersionByName.get(CREATE_ON_PAGE_DIALOG),
    domain_list: "google.com,wikipedia.org,example.com",
    sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
    upper_body:
      "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
    button_label: "CTA CLICK ME",
    button_target: "/premium",
    license_state_list: "free",
    display_duration: 1,
    // If expired commands are required, get expiry dates from 1 day in the past
    // otherwise, get them 1 day in the future
    expiry: getExpiryDate(expired ? -1 : 1),
  };

  const commandList = [];

  for (let k = 0; k < amountOfDialogs; k++) {
    const command = {
      ...baseCommand,
      ipm_id: `opdnavigationcta_${k}`,
      device_id: userId,
      lower_body: `deviceID: ${userId}`,
    };

    commandList.push(command);
  }

  return commandList;
}

/**
 * Generates an expiry date with valid format
 *
 * @param {number} daysToAdd
 *        Days to add (or reduce) to Today's date to generate expiration date:
 *        use positive values for non-expired commands,
 *        and zero or negative values for expired commands
 *
 * @returns {string} The expiry date
 */
export function getExpiryDate(daysToAdd) {
  if (typeof daysToAdd !== "number") {
    throw new Error("daysToAdd argument should be of type 'number' ");
  }

  const expiryFullDate = new Date();
  expiryFullDate.setDate(expiryFullDate.getDate() + daysToAdd);
  const expiryDate = expiryFullDate.toISOString().split("T")[0];
  return expiryDate;
}
