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

/**
 * The maximum number of commands that the extension can process when
 * handling a IPM server response.
 */
export const maximumProcessableCommands = 100;

/**
 * Command behavior
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Behavior {}

/**
 * Command behavior
 */
export interface LicenseStateBehavior extends Behavior {
  /**
   * A comma separate list of Premium license state(s)
   */
  licenseStateList?: string;
}

/**
 * Handler that gets called when command gets executed
 *
 * @param ipmId The IPM ID
 * @param isFragmentInitialization Whether the command handler is called during
 *  the fragment initialization phase (i.e. when processing commands that
 *  are being restored from storage, as opposed to processing commands that
 *  come in via a response from the IPM server during runtime).
 */
export type CommandHandler = (
  ipmId: string,
  isFragmentInitialization: boolean,
) => Promise<void>;

/**
 * An enum containing all known command names.
 */
export enum CommandName {
  createOnPageDialog = "create_on_page_dialog",
  createTab = "create_tab",
  deleteCommands = "delete_commands",
}

/**
 * A map that contains the version for each command.
 */
export const CommandVersion: Record<CommandName, number> = {
  [CommandName.createOnPageDialog]: 7,
  [CommandName.createTab]: 6,
  [CommandName.deleteCommands]: 2,
};

/**
 * The required IPM command meta data.
 */
interface CommandMetaData {
  /**
   * The command version.
   */
  version: number;
  /**
   * The name of the command.
   */
  command_name: CommandName;
  /**
   * The IPM id.
   */
  ipm_id: string;
  /**
   * The command expiration date.
   */
  expiry?: string;
  /**
   * A collection of attributes that do not come in via the IPM server, but
   * that are rather added by the internal IPM system instead.
   */
  attributes?: InternalAttributes;
}

export interface InternalAttributes {
  /**
   * A timestamp denoting when the command was received. This will not come
   * from the IPM server, but instead will be added by the extension.
   */
  received: number;
  /**
   * The browser language at the time when the command was received. We use
   * this to track whether the language changes between the command being
   * received and it being executed.
   */
  language: string;
}

/**
 * The interface describing a valid IPM command.
 */
export type Command = CommandMetaData & Record<string, unknown>;

/**
 * Command content
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Content {}

/**
 * Command actor
 */
export interface CommandActor {
  /**
   * Clears active commands
   *
   * This function is meant to clean up any non-persistent effects that the
   * handleCommand() function had on the extension state (e.g. close opened
   * tabs, remove event listeners, clear in-memory storage).
   */
  clearCommands: () => Promise<void> | void;
  /**
   * Retrieves the actor-specific command behavior
   *
   * @param command - Command
   * @returns actor-specific behavior (or null, if command is invalid)
   */
  getBehavior: (command: Command) => Behavior | null;
  /**
   * Retrieves the actor-specific command content
   *
   * @param command - Command
   * @returns actor-specific content (or null, if command is invalid)
   */
  getContent: (command: Command) => Content | null;
  /**
   * Handles given command
   */
  handleCommand: CommandHandler;
  /**
   * Checks whether the given command is valid for the actor
   *
   * @returns whether the given command is valid for the actor
   */
  isValidCommand: (command: Command) => boolean;
  /**
   * Get's called by the IPM system after all commands of a ping have been
   * processed.
   */
  onCommandsProcessed: () => void;
}

/**
 * General Command events
 */
export enum CommandEventType {
  expired = "command_expired",
}

/**
 * IPM delete-commands event names
 */
export enum DeleteEventType {
  sucess = "deletion_success",
  error = "deletion_error",
}
