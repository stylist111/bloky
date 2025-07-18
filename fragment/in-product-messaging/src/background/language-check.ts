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
import * as commandStorage from "./command-storage";
import { recordEvent } from "./event-recording";

/**
 * Runs a check to see whether the current user language still matches the
 * user language when the command was received. Will record an event in case
 * the language changed.
 *
 * @param ipmId The ID of the IPM command to run the check for
 */
export async function checkLanguage(ipmId: string): Promise<void> {
  const command = commandStorage.get(ipmId);
  if (command === null) {
    return;
  }

  const isSkewed = await isLanguageSkewed(ipmId);
  if (isSkewed) {
    recordEvent(command.ipm_id, command.command_name, "language_skew");
  }
}

/**
 * Checks whether the language attributed to the command with the given ID
 * matches the current browser language.
 *
 * @param ipmId The ID of the IPM command to run the check for
 * @returns true if the languages differ, false if they are the same
 */
export async function isLanguageSkewed(ipmId: string): Promise<boolean> {
  const command = commandStorage.get(ipmId);
  if (command === null) {
    return false;
  }

  if (typeof command.attributes?.language !== "string") {
    // This is an old command that didn't get enriched with additional attributes.
    return false;
  }

  if (browser.i18n.getUILanguage() === command.attributes.language) {
    return false;
  }

  return true;
}
