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

export const LoggingLevels = {
  type: "object",
  additionalProperties: true,
  properties: {
    global: {
      $ref: "#/definitions/LogLevel",
    },
    byModule: {
      type: "object",
      additionalProperties: {
        $ref: "#/definitions/LogLevel",
      },
    },
    mods: {
      type: "array",
      items: {
        type: "integer",
        minimum: 0,
        maximum: 1000,
      },
    },
  },
  required: ["mods"],
};

export const LogLevel = {
  type: "string",
  enum: ["debug", "info", "behavior", "warn", "off"],
};
