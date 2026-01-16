/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  type Command,
  type CommandHandler,
  CommandName,
  type Content,
  getFragment,
  type ParamDefinitionList
} from "~/ipm/background";
import * as logger from "../../../logger/background";
import { type DialogContent } from "../../shared";
import { type DialogBehavior } from "../dialog.types";
import { Timing } from "../timing.types";
import {
  defaultPriority,
  type DialogCommand,
  type DialogCommandContent,
  type DialogParams
} from "./ipm-onpage-dialog.types";

/**
 * List of on-page dialog parameter definitions
 */
function getParamDefinitionList(): ParamDefinitionList<DialogParams> {
  const {
    isEmpty,
    isEmptyOrPositiveNumber,
    isNotEmpty,
    isValidDomainList,
    isSafeUrl,
    isValidLicenseStateList
  } = getFragment();

  return [
    {
      name: "timing",
      validate: (param): boolean => {
        if (typeof param !== "string") {
          return false;
        }

        return (
          param === Timing.afterWebAllowlisting ||
          param === Timing.revisitWebAllowlisted ||
          param === Timing.afterNavigation ||
          param === Timing.cookieBanner
        );
      }
    },
    {
      name: "display_duration",
      validate: (param): boolean =>
        typeof param === "undefined" ||
        (typeof param === "number" && param >= 0 && param <= 20)
    },
    {
      name: "sub_title",
      validate: (param, commandVersion): boolean => {
        // Support for this parameter was removed in command version 8
        if (commandVersion >= 8) {
          return true;
        }

        return isNotEmpty(param);
      }
    },
    {
      name: "upper_body",
      validate: (param, commandVersion): boolean => {
        // Support for this parameter was removed in command version 8
        if (commandVersion >= 8) {
          return true;
        }

        return isNotEmpty(param);
      }
    },
    {
      name: "button_label",
      validate: (param, commandVersion): boolean => {
        // Support for this parameter was removed in command version 8
        if (commandVersion >= 8) {
          return true;
        }

        return isNotEmpty(param);
      }
    },
    {
      name: "button_target",
      validate: isSafeUrl
    },
    {
      name: "domain_list",
      validate: isValidDomainList
    },
    {
      name: "license_state_list",
      validate: isValidLicenseStateList
    },
    {
      name: "priority",
      validate: isEmptyOrPositiveNumber
    },
    {
      name: "lower_body",
      validate: (param, commandVersion): boolean => {
        // Support for this parameter was removed in command version 8
        if (commandVersion >= 8) {
          return true;
        }

        return typeof param === "undefined" || isNotEmpty(param);
      }
    },
    {
      name: "content",
      validate: (param, commandVersion) => {
        // Support for this parameter was added in command version 8
        if (commandVersion < 8) {
          return true;
        }

        if (param === null || typeof param !== "object") {
          return false;
        }

        if (!("en" in param)) {
          return false;
        }

        for (const content of Object.values(param)) {
          if (!isDialogCommandContent(content)) {
            return false;
          }

          if (
            isEmpty(content.button_label) ||
            isEmpty(content.sub_title) ||
            isEmpty(content.upper_body)
          ) {
            return false;
          }

          if (
            typeof content.lower_body !== "undefined" &&
            isEmpty(content.lower_body)
          ) {
            return false;
          }
        }

        return true;
      }
    }
  ];
}

/**
 * Extracts on-page dialog behavior from the given command
 *
 * @param command - Command to extract the behavior from
 * @returns on-page dialog behavior (or null, if command is invalid)
 */
function getBehavior(command: Command): DialogBehavior | null {
  if (!isDialogCommand(command)) {
    return null;
  }

  return {
    displayDuration:
      typeof command.display_duration === "number"
        ? command.display_duration
        : 5,
    target: command.button_target,
    timing: command.timing,
    domainList: command.domain_list,
    licenseStateList:
      command.license_state_list ?? getFragment().defaultLicenseState,
    priority:
      typeof command.priority === "number" ? command.priority : defaultPriority
  };
}

/**
 * Extracts on-page dialog content from the given command
 *
 * @param command - Command
 * @param content - Command content
 * @returns on-page dialog content (or null, if command is invalid)
 */
function getContent(command: Command, content: Content): DialogContent | null {
  if (!isDialogCommand(command) || !isDialogCommandContent(content)) {
    return null;
  }

  return {
    body:
      typeof content.lower_body === "string"
        ? [content.upper_body, content.lower_body]
        : [content.upper_body],
    button: content.button_label,
    title: content.sub_title
  };
}

/**
 * Runs parameter validation on the given command to check whether it can be
 * worked with. Will log validation errors.
 *
 * @param command The command to check
 * @returns Whether the command is a valid DialogCommand and can be worked with
 */
function isDialogCommand(command: Command): command is DialogCommand {
  const validationErrors = getFragment().validateParams(
    command,
    getParamDefinitionList()
  );

  if (validationErrors.length === 0) {
    return true;
  }

  logger.error(
    "[onpage-dialog]: Invalid parameters received:",
    validationErrors.join(" ")
  );
  return false;
}

/**
 * Checks if the candidate is a valid DialogCommandContent
 *
 * @param candidate - Candidate to check
 * @returns whether the candidate is a valid DialogCommandContent
 */
function isDialogCommandContent(
  candidate: unknown
): candidate is DialogCommandContent {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "button_label" in candidate &&
    "sub_title" in candidate &&
    "upper_body" in candidate
  );
}

/**
 * Sets on-page dialog command handler
 *
 * @param handler - Command handler
 * @param clearCommands - Function to clear active commands
 */
export function setDialogCommandHandler(
  handler: CommandHandler,
  clearCommands: () => void
): void {
  getFragment().setCommandActor(CommandName.createOnPageDialog, {
    clearCommands,
    getBehavior,
    getContent,
    handleCommand: handler,
    isValidCommand: isDialogCommand,
    onCommandsProcessed: () => {}
  });
}
