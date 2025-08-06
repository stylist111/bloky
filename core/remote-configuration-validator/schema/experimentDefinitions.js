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

export const Experiment = {
  type: "object",
  additionalProperties: true,
  properties: {
    experimentId: {
      type: "string",
    },
    name: {
      type: "string",
    },
    enabled: {
      type: "boolean",
    },
    variants: {
      type: "array",
      items: {
        $ref: "#/definitions/Variant",
      },
    },
  },
  required: ["experimentId", "variants"],
};

export const Flags = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export const Variant = {
  type: "object",
  additionalProperties: true,
  properties: {
    variantId: {
      type: "string",
    },
    flags: {
      $ref: "#/definitions/Flags",
    },
    mods: {
      type: "array",
      items: {
        type: "integer",
        minimum: 0,
        maximum: 1000,
      },
    },
    name: {
      type: "string",
    },
  },
  required: ["flags", "mods", "variantId"],
};
