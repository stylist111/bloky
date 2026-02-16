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
  type ContentMap,
  defaultLocale,
  maximumProcessableCommands,
  type TestingOverrideLocaleMessage,
} from "./command-library.types";
import * as commandStorage from "./command-storage";
import { getStartInfo, setStartInfo } from "./start-info";
import { type StartInfo } from "./start-info.types";
import { recordEvent, recordGenericEvent } from "./event-recording";

/**
 * A list of known commands.
 */
const knownCommandsList = Object.values(CommandName);

/**
 * Map of known command actors
 */
const actorByCommandName = new Map<CommandName, CommandActor>();

/**
 * List of commands that cannot be executed yet, including arguments to use
 * for executing them
 */
const unexecutableCommands = new Map<Command, boolean[]>();

/**
 * Server logger instance for IPM events
 */
const serverLogger = new ewe.telemetry.ServerLogger("in_product_messaging");

/**
 * Override of locale used for testing
 */
let localeOverride: string | null = null;

/**
 * Indicates whether IPM functionality is active
 */
let isActive = false;

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
    "command_name" in candidate
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
  if (!dismissedIpmIds.includes(ipmId)) {
    dismissedIpmIds.push(ipmId);
    setDismissedIpmIds(dismissedIpmIds);
  }

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

  const locale = localeOverride ?? browser.i18n.getUILanguage();
  const content = getContentForLocale(locale, command.content ?? {});
  return actor.getContent(command, content);
}

/**
 * Checks whether the IPM command has expired or not
 *
 * A command is expired if it is no longer in the remote IPM config
 *
 * @param command The IPM command
 * @returns Whether the IPM command has expired or not
 */
export function isCommandExpired(command: Command): boolean {
  // We synchronize our local command storage when the remote config changes,
  // so if we no longer have it in storage, it's expired
  return commandStorage.get(command.ipm_id) === null;
}

/**
 * Checks whether the user is part of the cohort that the IPM command is
 * targeting
 *
 * @param command - IPM command
 * @returns whether the user is part of the cohort that the IPM command is
 *   targeting
 */
async function matchesCohort(command: Command): Promise<boolean> {
  if (!command.cohort) {
    return true;
  }

  const cohorts = await ewe.cohorts.getAll();
  return cohorts.includes(command.cohort);
}

/**
 * Resolves content for given locale from given content map
 *
 * @param locale - Locale
 * @param [contentByLocale] - Content mapped by locale
 * @returns content
 */
function getContentForLocale(
  locale: string,
  contentByLocale: ContentMap,
): Content {
  if (locale in contentByLocale) {
    return contentByLocale[locale];
  }

  const [language] = locale.split("-", 1);
  if (language in contentByLocale) {
    return contentByLocale[language];
  }

  if (defaultLocale in contentByLocale) {
    return contentByLocale[defaultLocale];
  }

  return {};
}

/**
 * Retries executing commands that couldn't be executed
 *
 * @param commandName - Command name
 */
function retryExecuteCommands(commandName: CommandName): void {
  for (const [command, executionArguments] of unexecutableCommands) {
    if (command.command_name !== commandName) {
      continue;
    }

    unexecutableCommands.delete(command);
    void executeIPMCommands([command], ...executionArguments);
  }
}

/**
 * Executes a list of commands sent by the IPM server.
 *
 * @param commands A list of commands from the IPM server
 * @param isInitialization Whether the commands are being restored when the
 *   module initializes
 * @param isConfigUpdate Whether the commands are executed the first time after
 *   the underlying configuration got updated
 */
export async function executeIPMCommands(
  commands: unknown[],
  isInitialization: boolean = false,
  isConfigUpdate: boolean = false,
): Promise<void> {
  if (!isActive) {
    return;
  }

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

      // Dismiss outdated commands but keep commands that require a higher
      // version than present
      if (command.version < CommandVersion[command.command_name]) {
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

      // Ignore and dismiss command if it has expired
      dismissCommand(command.ipm_id);
      continue;
    }

    const actor = actorByCommandName.get(command.command_name);
    if (!actor) {
      logger.debug("[ipm]: No actor found:", command.command_name);
      unexecutableCommands.set(command, [isInitialization, isConfigUpdate]);
      continue;
    }

    if (!actor.isValidCommand(command)) {
      logger.reportAndLogError(
        new Error("[ipm]: Invalid parameters received."),
      );
      continue;
    }

    // queue command for execution
    actorByExecutableCommand.set(command, actor);
  }

  const commandHandlingPromises = Array.from(actorByExecutableCommand).map(
    async ([executableCommand, actor]) => {
      // We only need to know about whether the command was received whenever
      // the config changes, so no need to log it under any other circumstances
      if (isConfigUpdate) {
        serverLogger.behavior(
          "command_received",
          executableCommand.ipm_id,
          executableCommand.ipm_id,
        );
      }

      if (!(await matchesCohort(executableCommand))) {
        logger.debug("[ipm]: Cohort doesn't match.");
        return;
      }

      await actor.handleCommand(executableCommand.ipm_id, isInitialization);
    },
  );

  await Promise.all(commandHandlingPromises).then(() => {
    // let actors know that we're done process incoming commands
    knownCommandsList
      .map((name) => actorByCommandName.get(name))
      .forEach((actor) => actor?.onCommandsProcessed());
  });
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
 * Handles "ipm:testing.overrideLocale" message
 */
function handleTestingOverrideLocale(message: unknown): void {
  if (!isTestingOverrideLocaleMessage(message)) {
    return;
  }

  localeOverride = message.locale;
}

/**
 * Checks whether given candidate is message of type
 * "ipm:testing.overrideLocale"
 *
 * @param candidate - Candidate
 * @returns whether given candidate is message of type
 * "ipm:testing.overrideLocale"
 */
function isTestingOverrideLocaleMessage(
  candidate: unknown,
): candidate is TestingOverrideLocaleMessage {
  return (
    candidate !== null && typeof candidate === "object" && "locale" in candidate
  );
}

/**
 * Fetches IPM commands from remote config and synchronizes the locally
 * stored commands with what we received from the remote config.
 */
async function synchronizeRemoteCommands(): Promise<void> {
  const {
    getDismissedIpmIds,
    getLastSyncId,
    info,
    logger,
    setDismissedIpmIds,
    setLastSyncId,
  } = getStartInfo();

  const lastSyncId = getLastSyncId();
  const currentSyncId = (await ewe.remoteConfig.getRevisionId()) ?? "";
  const isConfigUpdate = currentSyncId !== lastSyncId;
  if (isConfigUpdate) {
    setLastSyncId(currentSyncId);
  }

  const remoteCommands = await getRemoteCommands();
  if (remoteCommands === null) {
    logger.reportAndLogError(new Error("[ipm]: No remote configuration."));
    return;
  }

  // In order to keep the behavior consistent with the legacy IPM fragment,
  // and to not clash with the integrated update campaigns, we are explicitly
  // ignoring IPMs for Firefox users while the legacy fragment is still around
  if (info.getBrowserName() === "firefox") {
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
  await executeIPMCommands(commands, true, isConfigUpdate);
}

/**
 * Initializes command library
 */
export async function start(startInfo: StartInfo): Promise<void> {
  setStartInfo(startInfo);

  isActive = true;

  void synchronizeRemoteCommands();

  ewe.remoteConfig.onChanged.addListener(synchronizeRemoteCommands);
  startInfo.addMessageListener(
    "ipm:testing.clearDismissedIpmIds",
    clearDismissedIpmIds,
  );
  startInfo.addMessageListener(
    "ipm:testing.getCommands",
    handleTestingGetCommandsMessage,
  );
  startInfo.addMessageListener(
    "ipm:testing.overrideLocale",
    handleTestingOverrideLocale,
  );
}

/**
 * Unloads command library
 */
export async function stop(): Promise<void> {
  const { removeMessageListener } = getStartInfo();

  isActive = false;

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
  removeMessageListener(
    "ipm:testing.overrideLocale",
    handleTestingOverrideLocale,
  );
}
