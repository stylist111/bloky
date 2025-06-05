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

import { getStoredCommandIds, setCommandActor } from "./command-library";
import {
  type Command,
  type CommandHandler,
  CommandName,
  type Content,
} from "./command-library.types";
import {
  deleteAllKey,
  type DeleteBehavior,
  type DeleteCommand,
  type DeleteParams,
} from "./delete-commands.types";
import { validateParams } from "./param-validator";
import type { ParamDefinitionList } from "./param-validator.types";
import { getStartInfo } from "./start-info";

/**
 * List of delete-commands parameter definitions
 */
const paramDefinitionList: ParamDefinitionList<DeleteParams> = [
  {
    name: "commands",
    validate: (param): boolean =>
      typeof param === "string" && param.trim() !== "",
  },
];

/**
 * Runs parameter validation on the given command to check whether it can be
 * worked with. Will log validation errors.
 *
 * @param command The command to check
 * @returns Whether the command is a valid DeleteCommand and can be worked with
 */
function isDeleteCommand(command: Command): command is DeleteCommand {
  const { logger } = getStartInfo();
  const validationErrors = validateParams(command, paramDefinitionList);
  if (validationErrors.length === 0) {
    return true;
  }

  logger.reportAndLogError(
    new Error(
      `[delete-commands]: Invalid parameters received: ${validationErrors.join(" ")}`,
    ),
  );
  return false;
}

/**
 * Checks whether given candidate is delete-commands behavior
 *
 * @param candidate - Candidate
 * @returns whether given candidate is delete-commands behavior
 */
export function isDeleteBehavior(
  candidate: unknown,
): candidate is DeleteBehavior {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "commandIds" in candidate
  );
}

/**
 * Extracts delete-commands behavior from the given command
 *
 * @param command - Command to extract the behavior from
 * @returns delete-commands behavior (or null, if command is invalid)
 */
function getBehavior(command: Command): DeleteBehavior | null {
  if (!isDeleteCommand(command)) {
    return null;
  }

  const commands = command.commands.trim();
  let commandIds;

  if (commands === deleteAllKey) {
    commandIds = getStoredCommandIds();
  } else {
    commandIds = commands.split(",").map((id) => id.trim());
  }

  return { commandIds };
}

/**
 * Extracts delete-commands content from the given command
 *
 * Currently there is no content in the IPM Command, so this will always
 * return an empty `Content` object.
 *
 * @returns delete-commands content
 */
function getContent(): Content {
  return {};
}

/**
 * Sets delete-commands IPM command handler
 *
 * @param handler - Command handler
 */
export function setDeleteCommandHandler(handler: CommandHandler): void {
  setCommandActor(CommandName.deleteCommands, {
    getBehavior,
    getContent,
    handleCommand: handler,
    isValidCommand: isDeleteCommand,
    onCommandsProcessed: () => {},
  });
}
