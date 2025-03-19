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

/**
 * Generates a list of a specific amount of OPD commands
 *
 * @param {number} amountOfDialogs - Amount of commands that will be generated
 * @param {string} userId - Server user identifier
 * @returns {Array<Object>} An array of commands
 */
export function getMultipleOPDCommands(amountOfDialogs, userId) {
  if (amountOfDialogs <= 0) {
    throw new Error("The amount of dialogs to generate should be greater than zero.");
  }

  if (!userId) {
    userId = "multipleOPDcommands";
  }

  const baseCommand = {
    command_name: "create_on_page_dialog",
    timing: "after_navigation",
    version: 4,
    domain_list: "google.com,wikipedia.org,example.com",
    sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
    upper_body:
      "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
    button_label: "CTA CLICK ME",
    button_target: "/premium",
    license_state_list: "free",
    display_duration: 1,
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
