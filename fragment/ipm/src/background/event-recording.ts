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

import { type CommandName, CommandVersion } from "./command-library.types";
import { storeEvent } from "./data-collection";
import { noCommand, noIPM } from "./event-recording.types";

/**
 * Records a user event that is connected to a certain command.
 *
 * @param ipmId - The IPM ID, or `null` if no IPM or ID is available
 * @param command - The name of the command the event belongs to
 * @param name - The name of the event to record
 */
export function recordEvent(
  ipmId: string | null,
  command: CommandName,
  name: string,
): void {
  const id = typeof ipmId === "string" ? ipmId : noIPM;
  void storeEvent(id, command, CommandVersion[command], name);
}

/**
 * Records an event that is not connected to a certain command.
 *
 * @param name The name of the event to record
 */
export function recordGenericEvent(name: string): void {
  void storeEvent(noIPM, noCommand, 0, name);
}
