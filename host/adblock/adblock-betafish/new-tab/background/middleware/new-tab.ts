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

import {
  Command,
  CommandHandler,
  CommandName,
  defaultLicenseState,
  ParamDefinitionList,
  isSafeUrl,
  isValidLicenseStates,
  setCommandActor,
  validateParams,
  isEmptyOrPositiveNumber,
} from "../../../ipm/background";
import * as logger from "~/utilities/background";
import {
  CreationMethod,
  NewTabBehavior,
  NewTabCommand,
  NewTabParams,
  defaultCreationMethod,
  defaultPriority,
} from "./new-tab.types";

/**
 * List of new tab parameter definitions
 */
const paramDefinitionList: ParamDefinitionList<NewTabParams> = [
  {
    name: "url",
    validate: isSafeUrl,
  },
  {
    name: "license_state_list",
    validate: isValidLicenseStates,
  },
  {
    name: "method",
    validate: (param): boolean =>
      typeof param === "undefined" ||
      (typeof param === "string" &&
        Object.values(CreationMethod)
          .map((method) => String(method))
          .includes(param)),
  },
  {
    name: "priority",
    validate: isEmptyOrPositiveNumber,
  },
];

/**
 * Runs parameter validation on the given command to check whether it can be
 * worked with. Will log validation errors.
 *
 * @param command The command to check
 * @returns Whether the command is a valid NewTabCommand and can be worked with
 */
function isNewTabCommand(command: Command): command is NewTabCommand {
  const validationErrors = validateParams(command, paramDefinitionList);
  if (validationErrors.length === 0) {
    return true;
  }

  logger.error("[new-tab]: Invalid parameters received:", validationErrors.join(" "));
  return false;
}

/**
 * Checks whether given candidate is new tab behavior
 *
 * @param candidate - Candidate
 *
 * @returns whether given candidate is new-tab behavior
 */
export function isNewTabBehavior(candidate: unknown): candidate is NewTabBehavior {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "target" in candidate &&
    "method" in candidate &&
    "priority" in candidate
  );
}

/**
 * Extracts new tab behavior from command
 *
 * @param command - Command
 *
 * @returns null
 */
function getBehavior(command: Command): NewTabBehavior | null {
  if (!isNewTabCommand(command)) {
    return null;
  }
  const method =
    typeof command.method === "undefined" ? defaultCreationMethod : CreationMethod[command.method];

  return {
    target: command.url,
    licenseStateList: command.license_state_list || defaultLicenseState,
    method,
    priority: typeof command.priority === "number" ? command.priority : defaultPriority,
  };
}

/**
 * Extracts new tab content from command
 * Currently there is no content in the IPM Command
 * so it returns null
 *
 * @param command - Command
 *
 * @returns null
 */
function getContent(): null {
  return null;
}

/**
 * Sets new tab command handler
 *
 * @param handler - Command handler
 * @param onCommandsProcessed - Called when all commands in a ping are processed
 */
export function setNewTabCommandHandler(
  handler: CommandHandler,
  onCommandsProcessed: () => void,
): void {
  setCommandActor(CommandName.createTab, {
    getBehavior,
    getContent,
    handleCommand: handler,
    isValidCommand: isNewTabCommand,
    onCommandsProcessed,
  });
}
