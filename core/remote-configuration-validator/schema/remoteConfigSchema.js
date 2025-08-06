/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  All,
  Any,
  Conditions,
  Cohort,
  Event,
  Not,
  Params,
  Value,
} from "./cohortDefinitions.js";
import { Experiment, Flags, Variant } from "./experimentDefinitions.js";
import {
  CreateOnpageDialogCommand,
  CreateTabCommand,
  DeleteCommandsCommand,
} from "./ipmDefinitions.js";
import { LoggingLevels, LogLevel } from "./loggingLevelsDefinitions.js";

export const remoteConfigSchema = {
  $schema: "http://json-schema.org/draft-06/schema#",
  $id: "https://eyeo.com/remoteConfigSchema",
  $ref: "#/definitions/RemoteConfigSchema",
  definitions: {
    RemoteConfigSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        schemaId: {
          type: "string",
        },
        experiments: {
          type: "array",
          items: {
            $ref: "#/definitions/Experiment",
          },
        },
        cohorts: {
          type: "array",
          items: {
            $ref: "#/definitions/Cohort",
          },
        },
        loggingLevels: {
          $ref: "#/definitions/LoggingLevels",
        },
        ipmCommands: {
          type: "array",
          items: {
            anyOf: [
              { $ref: "#/definitions/CreateOnpageDialogCommand" },
              { $ref: "#/definitions/CreateTabCommand" },
              { $ref: "#/definitions/DeleteCommandsCommand" },
            ],
          },
        },
      },
      required: ["experiments", "schemaId"],
    },
    Cohort,
    Conditions,
    All,
    Any,
    Not,
    Params,
    Event,
    Experiment,
    Variant,
    Flags,
    Value,
    LoggingLevels,
    LogLevel,
    CreateOnpageDialogCommand,
    CreateTabCommand,
    DeleteCommandsCommand,
  },
};
