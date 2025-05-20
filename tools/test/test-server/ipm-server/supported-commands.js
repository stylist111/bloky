/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Command names supported by the extension
 */
export const CREATE_ON_PAGE_DIALOG = "create_on_page_dialog";
export const CREATE_TAB = "create_tab";
export const DELETE_COMMANDS = "delete_commands";

/**
 * Currently supported command versions by the extension
 */
export const commandVersionByName = new Map([
  [CREATE_ON_PAGE_DIALOG, 6],
  [CREATE_TAB, 6],
  [DELETE_COMMANDS, 2],
]);
