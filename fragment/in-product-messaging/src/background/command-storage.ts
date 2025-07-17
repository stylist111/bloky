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

/**
 * Retrieves all the stored commands
 *
 * @returns All the stored commands in a commandId-to-command map shape
 */
export function getAll(): CommandMap {
  const { fetchCommands } = getStartInfo();
  return fetchCommands();
}

/**
 * Retrieves the stored command for the given ID
 *
 * @param id The ID command
 * @returns The stored command for the given ID or null otherwise
 */
export function get(id: string): Command | null {
  const storedCommands = getAll();
  return storedCommands[id] || null;
}

/**
 * Retrieves a list of stored command IDs
 *
 * @returns An array with command IDs or empty array if there's no commands
 */
export function getIds(): string[] {
  const storedCommands = getAll();

  return Object.keys(storedCommands);
}

/**
 * Adds a list of commands to the storage
 *
 * @param commands A list of commands to add to the storage
 */
export async function add(commands: Command[]): Promise<void> {
  const { logger, persistCommands } = getStartInfo();
  let commandStorageModified = false;
  const commandsToStore = getAll();

  for (const command of commands) {
    if (typeof commandsToStore[command.ipm_id] !== "undefined") {
      logger.debug("[ipm]: Campaign already stored:", command.ipm_id);
      continue;
    }

    commandsToStore[command.ipm_id] = command;
    commandStorageModified = true;
  }

  if (commandStorageModified) {
    await persistCommands(commandsToStore);
  }
}

/**
 * Removes from storage the command for the given ID
 *
 * @param id The ID for the command to remove
 */
export async function remove(id: string): Promise<void> {
  const { fetchCommands, persistCommands } = getStartInfo();

  const command = get(id);
  if (!command) {
    return;
  }

  const commandsToStore = fetchCommands();
  // We can't use a Map or Set for `commandStorage`, so we need dynamic
  // deletion here.
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete commandsToStore[command.ipm_id];
  await persistCommands(commandsToStore);
}
