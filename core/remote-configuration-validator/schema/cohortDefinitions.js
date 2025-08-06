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

export const All = {
  type: "object",
  additionalProperties: true,
  properties: {
    fact: {
      type: "string",
    },
    operator: {
      type: "string",
    },
    value: {
      $ref: "#/definitions/Value",
    },
    path: {
      type: "string",
    },
    params: {
      $ref: "#/definitions/Params",
    },
    any: {
      anyOf: [
        {
          $ref: "#/definitions/Any",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Any" },
        },
      ],
    },
    all: [
      {
        $ref: "#/definitions/All",
      },
      {
        type: "array",
        items: { $ref: "#/definitions/All" },
      },
    ],
    not: {
      anyOf: [
        {
          $ref: "#/definitions/Not",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Not" },
        },
      ],
    },
  },
  required: [],
};

export const Any = {
  type: "object",
  additionalProperties: true,
  properties: {
    fact: {
      type: "string",
    },
    operator: {
      type: "string",
    },
    value: {
      $ref: "#/definitions/Value",
    },
    path: {
      type: "string",
    },
    params: {
      $ref: "#/definitions/Params",
    },
    any: {
      anyOf: [
        {
          $ref: "#/definitions/Any",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Any" },
        },
      ],
    },
    all: [
      {
        $ref: "#/definitions/All",
      },
      {
        type: "array",
        items: { $ref: "#/definitions/All" },
      },
    ],
    not: {
      anyOf: [
        {
          $ref: "#/definitions/Not",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Not" },
        },
      ],
    },
  },
  required: [],
};

export const Cohort = {
  type: "object",
  additionalProperties: true,
  properties: {
    name: {
      type: "string",
    },
    conditions: {
      $ref: "#/definitions/Conditions",
    },
    event: {
      $ref: "#/definitions/Event",
    },
  },
  required: ["conditions", "event", "name"],
};

export const Conditions = {
  type: "object",
  additionalProperties: false,
  properties: {
    any: {
      anyOf: [
        {
          $ref: "#/definitions/Any",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Any" },
        },
      ],
    },
    all: {
      anyOf: [
        {
          $ref: "#/definitions/All",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/All" },
        },
      ],
    },
    not: {
      anyOf: [
        {
          $ref: "#/definitions/Not",
        },
        {
          type: "array",
          items: { $ref: "#/definitions/Not" },
        },
      ],
    },
  },
  required: [],
};

export const Event = {
  type: "object",
  additionalProperties: true,
  properties: {
    type: {
      type: "string",
    },
  },
  required: ["type"],
};

export const Not = {
  type: "object",
  additionalProperties: true,
  properties: {
    fact: {
      type: "string",
    },
    operator: {
      type: "string",
    },
    value: {
      $ref: "#/definitions/Value",
    },
    path: {
      type: "string",
    },
    params: {
      $ref: "#/definitions/Params",
    },
    not: {
      $ref: "#/definitions/Not",
    },
    any: {
      $ref: "#/definitions/Any",
    },
    all: {
      $ref: "#/definitions/All",
    },
  },
  required: [],
};

export const Params = {
  type: "object",
  additionalProperties: true,
  properties: {},
  required: [],
};

export const Value = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "string",
      },
    },
    {
      type: "object",
      additionalProperties: true,
      properties: {
        fact: {
          type: "string",
        },
        path: {
          type: "string",
        },
        params: {
          $ref: "#/definitions/Params",
        },
      },
    },
    {
      type: "boolean",
    },
    {
      type: "integer",
    },
    {
      type: "string",
    },
  ],
};
