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

/**
 * A function to validate a parameter.
 */
export type ParamValidator = (param: unknown) => boolean;

/**
 * A definition for a parameter.
 */
export interface ParamDefinition<T> {
  /**
   * The name of the parameter.
   */
  name: keyof T;
  /**
   * A function to validate the parameter.
   */
  validate: ParamValidator;
}

/**
 * A list of parameter definitions.
 */
export type ParamDefinitionList<T> = Array<ParamDefinition<T>>;
