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

import type { Behavior, Command } from "./command-library.types";

/**
 * Delete-commands behavior
 */
export interface DeleteBehavior extends Behavior {
  /**
   * List of IPM command IDs to delete
   */
  commandIds: string[];
}

/**
 * Parameter key value to delete all commands
 */
export const deleteAllKey = "__all__";

/**
 * Delete-commands IPM command parameters
 */
export interface DeleteParams {
  commands: string;
}

/**
 * A valid IPM command to delete commands
 */
export type DeleteCommand = Command & DeleteParams;
