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
    button_label: { type: "string" },
    button_target: { type: "string" },
    display_duration: {
      type: "integer",
      minimum: 0,
      maximum: 20,
    },
    domain_list: { type: "string" },
    license_state_list: { type: "string" },
    lower_body: { type: "string" },
    priority: {
      type: "integer",
      minimum: 1,
    },
    sub_title: { type: "string" },
    timing: { type: "string" },
    upper_body: { type: "string" },
  },
  required: [
    ...requiredBasePropertiesKeys,
    "button_label",
    "button_target",
    "sub_title",
    "timing",
    "upper_body",
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
