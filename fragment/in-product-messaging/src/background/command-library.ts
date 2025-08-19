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
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import {
  type Behavior,
  type Command,
  type CommandActor,
  CommandEventType,
  type CommandMap,
  CommandName,
  CommandVersion,
  type Content,
  DeleteEventType,
  maximumProcessableCommands,
} from "./command-library.types";
import * as commandStorage from "./command-storage";
import { getStartInfo, setStartInfo } from "./start-info";
import { type StartInfo } from "./start-info.types";
import { isDeleteBehavior, setDeleteCommandHandler } from "./delete-commands";
import { recordEvent, recordGenericEvent } from "./event-recording";
import { checkLanguage } from "./language-check";
import { isValidDate } from "./param-validator";

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
export function isCommandMap(candidate: unknown): candidate is CommandMap {
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
export function setCommandActor(
  commandName: CommandName,
  actor: CommandActor,
): void {
  actorByCommandName.set(commandName, actor);
  retryExecuteCommands(commandName);
}

/**
 * Removes the command data from persistent storage
 *
 * @param ipmId - IPM ID
 */
export function dismissCommand(ipmId: string): void {
  const { getDismissedIpmIds, setDismissedIpmIds } = getStartInfo();

  const dismissedIpmIds = getDismissedIpmIds();
  dismissedIpmIds.push(ipmId);
  setDismissedIpmIds(dismissedIpmIds);

  commandStorage.remove(ipmId);
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
  return commandStorage.get(ipmId);
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
    void executeIPMCommands([command], isInitialization);
  }
}

/**
 * Executes a list of commands sent by the IPM server.
 *
 * @param commands A list of commands from the IPM server
 * @param isInitialization Whether the commands are being restored when the
 *   module initializes
 */
export async function executeIPMCommands(
  commands: unknown[],
  isInitialization: boolean = false,
): Promise<void> {
  const { logger } = getStartInfo();
  const actorByExecutableCommand = new Map<Command, CommandActor>();

  if (commands.length > maximumProcessableCommands) {
    logger.reportAndLogError(new Error("[ipm]: Too many commands received."));
    recordGenericEvent("too_many_commands");
    return;
  }

  for (const command of commands) {
    if (!isCommand(command)) {
      logger.reportAndLogError(new Error("[ipm]: Invalid command received."));
      continue;
    }

    if (!knownCommandsList.includes(command.command_name)) {
      logger.reportAndLogError(
        new Error(
          `[ipm]: Unknown command name received: ${command.command_name}`,
        ),
      );
      continue;
    }

    if (command.version !== CommandVersion[command.command_name]) {
      logger.reportAndLogError(
        new Error(
          `[ipm]: Command version mismatch for command "${
            command.command_name
          }". Requested version was ${command.version}, version present is ${
            CommandVersion[command.command_name]
          }`,
        ),
      );

      // cleanup commands whose version has become outdated from local storage
      if (isInitialization) {
        dismissCommand(command.ipm_id);
      }

      continue;
    }

    if (isCommandExpired(command)) {
      logger.reportAndLogError(new Error("[ipm]: Command has expired."));
      recordEvent(
        command.ipm_id,
        command.command_name,
        CommandEventType.expired,
      );

      // cleanup commands that have expired from local storage
      if (isInitialization) {
        dismissCommand(command.ipm_id);
      }

      continue;
    }

    const actor = actorByCommandName.get(command.command_name);
    if (!actor) {
      logger.debug("[ipm]: No actor found:", command.command_name);
      unexecutableCommands.set(command, isInitialization);
      continue;
    }

    if (!actor.isValidCommand(command)) {
      logger.reportAndLogError(
        new Error("[ipm]: Invalid parameters received."),
      );
      continue;
    }

    // add timestamp and language information
    if (!("attributes" in command)) {
      command.attributes = {
        received: Date.now(),
        language: browser.i18n.getUILanguage(),
      };
    }

    // queue command for execution
    actorByExecutableCommand.set(command, actor);
  }

  const executableCommands = Array.from(actorByExecutableCommand.keys());
  // store the valid commands, if just received from the server
  if (!isInitialization && executableCommands.length > 0) {
    commandStorage.add(executableCommands);
  }

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
 * Registers a delete-commands event with the data collection feature.
 *
 * @param ipmId The ipm id to register the event for
 * @param name The event name to register
 */
function registerDeleteEvent(
  ipmId: string,
  name: CommandEventType | DeleteEventType,
): void {
  recordEvent(ipmId, CommandName.deleteCommands, name);
}

/**
 * Handles delete-commands IPM command
 *
 * @param ipmId
 * @returns
 */
async function handleDeleteCommand(ipmId: string): Promise<void> {
  const { logger } = getStartInfo();
  const command = getCommand(ipmId);
  if (!command) {
    return;
  }

  const behavior = getBehavior(ipmId);

  if (!isDeleteBehavior(behavior)) {
    logger.reportAndLogError(
      new Error("[delete-commands]: Invalid command behavior."),
    );
    return;
  }

  // run mandatory language check
  void checkLanguage(ipmId);

  // Ignore and dismiss command if it has expired
  if (isCommandExpired(command)) {
    logger.reportAndLogError(
      new Error("[delete-commands]: Command has expired."),
    );
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
      logger.reportAndLogError(
        new Error(
          `[delete-commands]: Error trying to delete command with ID ${commandId}`,
        ),
      );
    }
  }

  registerDeleteEvent(
    ipmId,
    success ? DeleteEventType.sucess : DeleteEventType.error,
  );
  dismissCommand(ipmId);
}

/**
 * Clears active commands
 */
export async function clearCommands(): Promise<void> {
  for (const actor of actorByCommandName.values()) {
    await actor.clearCommands();
  }
}

/**
 * Retrieves commands from remote config
 *
 * @returns commands from remote config (or null, if there is no remote config)
 */
async function getRemoteCommands(): Promise<Command[] | null> {
  const { logger } = getStartInfo();

  const remoteCommandCandidates = await ewe.remoteConfig.getIpmCommands();
  if (remoteCommandCandidates === null) {
    return null;
  }

  const remoteCommands: Command[] = [];
  for (const candidate of remoteCommandCandidates) {
    if (!isCommand(candidate)) {
      logger.reportAndLogError(new Error("[ipm]: Invalid command received."));
      continue;
    }

    remoteCommands.push(candidate);
  }

  return remoteCommands;
}

/**
 * Clears list of ignored IPMs
 */
function clearDismissedIpmIds(): void {
  const { setDismissedIpmIds } = getStartInfo();
  setDismissedIpmIds([]);
}

/**
 * Handles "ipm:testing.getCommands" message
 *
 * @returns stored commands in commandId-to-command map shape
 */
function handleTestingGetCommandsMessage(): CommandMap {
  return commandStorage.getAll();
}

/**
 * Fetches IPM commands from remote config and synchronizes the locally
 * stored commands with what we received from the remote config.
 */
async function synchronizeRemoteCommands(): Promise<void> {
  const { getDismissedIpmIds, logger, setDismissedIpmIds } = getStartInfo();
  const remoteCommands = await getRemoteCommands();
  if (remoteCommands === null) {
    logger.reportAndLogError(new Error("[ipm]: No remote configuration."));
    return;
  }

  // Filter out commands that we already executed
  const dismissedIpmIds = getDismissedIpmIds();
  const commands = remoteCommands.filter((command) => {
    return !dismissedIpmIds.includes(command.ipm_id);
  });

  // Update list of ignored IPM IDs
  const newDismissedIpmIds = dismissedIpmIds.filter((ipmId) => {
    return remoteCommands.some((command) => command.ipm_id === ipmId);
  });
  setDismissedIpmIds(newDismissedIpmIds);

  // Set stored commands list
  const commandMap = Object.fromEntries(
    commands.map((command) => [command.ipm_id, command]),
  );
  commandStorage.replaceAll(commandMap);

  // Execute commands
  await executeIPMCommands(commands, true);
}

/**
 * Initializes command library
 */
export async function start(startInfo: StartInfo): Promise<void> {
  setStartInfo(startInfo);

  setDeleteCommandHandler(handleDeleteCommand);

  await synchronizeRemoteCommands();

  ewe.remoteConfig.onChanged.addListener(synchronizeRemoteCommands);
  startInfo.addMessageListener(
    "ipm:testing.clearDismissedIpmIds",
    clearDismissedIpmIds,
  );
  startInfo.addMessageListener(
    "ipm:testing.getCommands",
    handleTestingGetCommandsMessage,
  );
}

/**
 * Unloads command library
 */
export async function stop(): Promise<void> {
  const { removeMessageListener } = getStartInfo();

  await clearCommands();

  ewe.remoteConfig.onChanged.removeListener(synchronizeRemoteCommands);
  removeMessageListener(
    "ipm:testing.clearDismissedIpmIds",
    clearDismissedIpmIds,
  );
  removeMessageListener(
    "ipm:testing.getCommands",
    handleTestingGetCommandsMessage,
  );
}
