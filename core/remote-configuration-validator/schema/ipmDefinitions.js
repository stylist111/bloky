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

const requiredBaseProperties = {
  cohort: { type: "string" },
  command_name: { type: "string" },
  ipm_id: { type: "string" },
  version: { type: "integer" },
};
const requiredBasePropertiesKeys = ["command_name", "ipm_id", "version"];

export const CreateOnpageDialogCommand = {
  type: "object",
  properties: {
    ...requiredBaseProperties,
    button_target: { type: "string" },
    content: {
      type: "object",
      additionalProperties: false,
      patternProperties: {
        "^[a-z]+(-[A-Z0-9]+)?$": {
          type: "object",
          properties: {
            button_label: { type: "string" },
            lower_body: { type: "string" },
            sub_title: { type: "string" },
            upper_body: { type: "string" },
          },
          required: ["button_label", "sub_title", "upper_body"],
        },
      },
      required: ["en"],
    },
    display_duration: {
      type: "integer",
      minimum: 0,
      maximum: 20,
    },
    domain_list: { type: "string" },
    license_state_list: { type: "string" },
    priority: {
      type: "integer",
      minimum: 1,
    },
    timing: { type: "string" },
  },
  required: [
    ...requiredBasePropertiesKeys,
    "button_target",
    "content",
    "timing",
  ],
};

export const CreateTabCommand = {
  type: "object",
  properties: {
    ...requiredBaseProperties,
    license_state_list: { type: "string" },
    method: { type: "string" },
    priority: {
      type: "integer",
      minimum: 1,
    },
    url: { type: "string" },
  },
  required: [...requiredBasePropertiesKeys, "url"],
};

export const DeleteCommandsCommand = {
  type: "object",
  properties: {
    ...requiredBaseProperties,
    commands: { type: "string" },
  },
  required: [...requiredBasePropertiesKeys, "commands"],
};
