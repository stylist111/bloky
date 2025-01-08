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

import browser from "webextension-polyfill";
import * as logger from "../../utilities/background";
import { Prefs } from "../../alias/prefs";
import {
  Behavior,
  Command,
  CommandActor,
  CommandEventType,
  CommandName,
  CommandVersion,
  commandStorageKey,
  Content,
  DeleteEventType,
  maximumProcessableCommands,
} from "./command-library.types";
import { isDeleteBehavior, setDeleteCommandHandler } from "./delete-commands";
import { recordEvent, recordGenericEvent } from "./event-recording";
import { isValidDate } from "./param-validator";
import { checkLanguage } from "./language-check";

/**
 * A list of known commands.
 */
const knownCommandsList = Object.values(CommandName);

/**
 * Map of known command actors
 */
const actorByCommandName = new Map<CommandName, CommandActor>();

/**
 * List of commands that cannot be executed yet, including indication
 * whether they are meant to be reinitialized
 */
const unexecutableCommands = new Map<Command, boolean>();

/**
 * Checks whether the given input satisfies the requirements to be treated
 * as a command from the IPM server, and to be precessed further.
 *
 * @param candidate The input to check
 * @returns True if the command is a valid IPM command, false if not
 */
function isCommand(candidate: unknown): candidate is Command {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "version" in candidate &&
    "ipm_id" in candidate &&
    "command_name" in candidate &&
    "expiry" in candidate
  );
}

/**
 * Checks whether given candidate is a map of commands
 *
 * @param candidate - Candidate
 *
 * @returns whether candidate is a map of commands
 */
export function isCommandMap(candidate: unknown): candidate is Record<string, Command> {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    Object.keys(candidate).every((key) => typeof key === "string") &&
    Object.values(candidate).every(isCommand)
  );
}

/**
 * Sets actor for handling command with given name
 *
 * @param commandName - Command name
 * @param actor - Command actor
 */
export function setCommandActor(commandName: CommandName, actor: CommandActor): void {
  actorByCommandName.set(commandName, actor);
  retryExecuteCommands(commandName);
}

/**
 * Removes the command data from persistent storage
 *
 * @param ipmId - IPM ID
 */
export function dismissCommand(ipmId: string): void {
  const command = getCommand(ipmId);
  if (!command) {
    return;
  }

  const commandStorage = Prefs.get(commandStorageKey);
  delete commandStorage[command.ipm_id];
  Prefs.set(commandStorageKey, commandStorage);
}

/**
 * Retrieves command behavior for given IPM ID
 *
 * @param ipmId - IPM ID
 *
 * @returns command behavior
 */
export function getBehavior(ipmId: string): Behavior | null {
  const command = getCommand(ipmId);
  if (!command) {
    return null;
  }

  const actor = actorByCommandName.get(command.command_name);
  if (!actor) {
    return null;
  }

  return actor.getBehavior(command);
}

/**
 * Retrieves command for given IPM ID
 *
 * @param ipmId - IPM ID
 *
 * @returns command
 */
export function getCommand(ipmId: string): Command | null {
  const commandStorage = Prefs.get(commandStorageKey);
  return commandStorage[ipmId] || null;
}

/**
 * Retrieves a list of stored IPM command IDs
 *
 * @returns An array with command IDs or empty array if there's no commands
 */
export function getStoredCommandIds(): string[] {
  const commandStorage = Prefs.get(commandStorageKey);

  if (!isCommandMap(commandStorage)) {
    return [];
  }

  return Object.keys(commandStorage);
}

/**
 * Retrieves command content for given IPM ID
 *
 * @param ipmId - IPM ID
 *
 * @returns command content
 */
export function getContent(ipmId: string): Content | null {
  const command = getCommand(ipmId);
  if (!command) {
    return null;
  }

  const actor = actorByCommandName.get(command.command_name);
  if (!actor) {
    return null;
  }

  return actor.getContent(command);
}

/**
 * Checks whether the command with the given id has already been processed
 * at an earlier time.
 *
 * @param ipmId The IPM id
 * @returns Whether the command with the given id has already been processed
 */
function hasProcessedCommand(ipmId: string): boolean {
  const commandStorage = Prefs.get(commandStorageKey);
  return ipmId in commandStorage;
}

/**
 * Checks whether the IPM command has expired or not
 *
 * @param command The IPM command
 * @returns Whether the IPM command has expired or not
 */
export function isCommandExpired(command: Command): boolean {
  if (!isValidDate(command.expiry)) {
    return true;
  }

  // Expiry command parameter will only have date data without time
  const expiryDateOnly = new Date(command.expiry);
  const nowDateTime = new Date();

  if (nowDateTime >= expiryDateOnly) {
    return true;
  }

  return false;
}

/**
 * Retries executing commands that couldn't be executed
 *
 * @param commandName - Command name
 */
function retryExecuteCommands(commandName: CommandName): void {
  for (const [command, isInitialization] of unexecutableCommands) {
    if (command.command_name !== commandName) {
      continue;
    }

    unexecutableCommands.delete(command);
    executeIPMCommands([command], isInitialization);
  }
}

/**
 * Stores the commands data to persistent storage.
 *
 * @param commands A list of commands from the IPM server
 */
function storeCommands(commands: Command[]): void {
  const storage = Prefs.get(commandStorageKey);

  for (const command of commands) {
    storage[command.ipm_id] = command;
  }

  void Prefs.set(commandStorageKey, storage);
}

/**
 * Executes a list of commands sent by the IPM server.
 *
 * @param commands A list of commands from the IPM server
 * @param isInitialization Whether the commands are being restored when the
 *   module initializes
 */
export function executeIPMCommands(commands: unknown[], isInitialization: boolean = false): void {
  const actorByExecutableCommand = new Map<Command, CommandActor>();

  if (commands.length > maximumProcessableCommands) {
    logger.error("[ipm]: Too many commands received.");
    recordGenericEvent("too_many_commands");
    return;
  }

  for (const command of commands) {
    if (!isCommand(command)) {
      logger.error("[ipm]: Invalid command received.");
      continue;
    }

    if (!knownCommandsList.includes(command.command_name)) {
      logger.error("[ipm]: Unknown command name received:", command.command_name);
      continue;
    }

    if (command.version !== CommandVersion[command.command_name]) {
      logger.error(
        `[ipm]: Command version mismatch for command "${
          command.command_name
        }". Requested version was ${command.version}, version present is ${
          CommandVersion[command.command_name]
        }`,
      );
      continue;
    }

    if (isCommandExpired(command)) {
      logger.error("[ipm]: Command has expired.");
      recordEvent(command.ipm_id, command.command_name, CommandEventType.expired);

      // cleanup commands that have expired from local storage
      if (isInitialization) {
        dismissCommand(command.ipm_id);
      }

      continue;
    }

    const actor = actorByCommandName.get(command.command_name);
    if (!actor) {
      logger.warn("[ipm]: No actor found:", command.command_name);
      unexecutableCommands.set(command, isInitialization);
      continue;
    }

    if (!actor.isValidCommand(command)) {
      logger.error("[ipm]: Invalid parameters received.");
      continue;
    }

    // add timestamp and language information
    if (!("attributes" in command)) {
      // eslint-disable-next-line no-param-reassign
      command.attributes = {
        received: Date.now(),
        language: browser.i18n.getUILanguage(),
      };
    }

    if (!isInitialization) {
      if (hasProcessedCommand(command.ipm_id)) {
        logger.error("[ipm]: Campaign already processed:", command.ipm_id);
        continue;
      }

      actorByExecutableCommand.set(command, actor);
    }
  }

  const executableCommands = Array.from(actorByExecutableCommand.keys());
  storeCommands(executableCommands);

  const commandHandlingPromises = Array.from(actorByExecutableCommand).map(
    async ([executableCommand, actor]) => {
      await actor.handleCommand(executableCommand.ipm_id, isInitialization);
    },
  );

  void Promise.all(commandHandlingPromises).then(() => {
    // let actors know that we're done process incoming commands
    knownCommandsList
      .map((name) => actorByCommandName.get(name))
      .forEach((actor) => actor?.onCommandsProcessed());
  });
}

/**
 * Removes all commands & records a IPM cancelled event
 * that match the function parameter
 *
 */
export async function removeAllCommands(name: CommandName): Promise<void> {
  await Prefs.untilLoaded;

  // Remove all commands in storage
  const commandStorage = Prefs.get(commandStorageKey);
  for (const command of Object.values(commandStorage)) {
    if (isCommand(command) && name === command.command_name) {
      logger.debug("[ipm]: removing command ", command.ipm_id, command.command_name);
      recordEvent(command.ipm_id, command.command_name, CommandEventType.ipmCancelled);
      dismissCommand(command.ipm_id);
    }
  }
}

/**
 * Registers a delete-commands event with the data collection feature.
 *
 * @param ipmId The ipm id to register the event for
 * @param name The event name to register
 */
function registerDeleteEvent(ipmId: string, name: CommandEventType | DeleteEventType): void {
  recordEvent(ipmId, CommandName.deleteCommands, name);
}

/**
 * Handles delete-commands IPM command
 *
 * @param ipmId
 * @returns
 */
async function handleDeleteCommand(ipmId: string): Promise<void> {
  const command = getCommand(ipmId);
  if (!command) {
    return;
  }

  const behavior = getBehavior(ipmId);

  if (!isDeleteBehavior(behavior)) {
    logger.error("[delete-commands]: Invalid command behavior.");
    return;
  }

  // run mandatory language check
  void checkLanguage(ipmId);

  // Ignore and dismiss command if it has expired
  if (isCommandExpired(command)) {
    logger.error("[delete-commands]: Command has expired.");
    registerDeleteEvent(ipmId, CommandEventType.expired);
    dismissCommand(ipmId);
    return;
  }

  const { commandIds } = behavior;
  let success = true;

  for (const commandId of commandIds) {
    try {
      dismissCommand(commandId);

      if (getCommand(commandId) !== null) {
        throw new Error("Command was not successfully deleted.");
      }
    } catch (error) {
      success = false;
      logger.error("[delete-commands]: Error trying to delete command with ID ", commandId);
    }
  }

  registerDeleteEvent(ipmId, success ? DeleteEventType.sucess : DeleteEventType.error);
  dismissCommand(ipmId);
}

/**
 * Initializes command library
 */
async function start(): Promise<void> {
  await Prefs.untilLoaded;

  setDeleteCommandHandler(handleDeleteCommand);

  // Reinitialize commands from storage
  const commandStorage = Prefs.get(commandStorageKey);

  if (!isCommandMap(commandStorage)) {
    return;
  }

  const commands = Object.values(commandStorage);
  executeIPMCommands(commands, true);
}

start().catch(logger.error);
