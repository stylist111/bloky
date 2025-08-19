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

import type { CommandMap, Command } from "./command-library.types";
import { getStartInfo } from "./start-info";

let storedCommands: CommandMap = {};

/**
 * Retrieves all the stored commands
 *
 * @returns All the stored commands in a commandId-to-command map shape
 */
export function getAll(): CommandMap {
  return storedCommands;
}

/**
 * Retrieves the stored command for the given ID
 *
 * @param id The command ID
 * @returns The stored command for the given ID or null otherwise
 */
export function get(id: string): Command | null {
  return storedCommands[id] || null;
}

/**
 * Retrieves a list of stored command IDs
 *
 * @returns An array with command IDs or empty array if there's no commands
 */
export function getIds(): string[] {
  return Object.keys(storedCommands);
}

/**
 * Adds a list of commands to the storage
 *
 * @param commands A list of commands to add to the storage
 */
export function add(commands: Command[]): void {
  const { logger } = getStartInfo();
  const storedCommands = getAll();

  for (const command of commands) {
    if (typeof storedCommands[command.ipm_id] !== "undefined") {
      logger.debug("[ipm]: Campaign already stored:", command.ipm_id);
      continue;
    }

    storedCommands[command.ipm_id] = command;
  }
}

/**
 * Removes from storage the command for the given ID
 *
 * @param id The ID for the command to remove
 */
export function remove(id: string): void {
  const command = get(id);
  if (!command) {
    return;
  }

  // We can't use a Map or Set for `commandStorage`, so we need dynamic
  // deletion here.
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete storedCommands[command.ipm_id];
}

/**
 * Replaces the stored command map with the given command map.
 *
 * @param commandMap The command map to store
 */
export function replaceAll(commandMap: CommandMap): void {
  storedCommands = { ...commandMap };
}
