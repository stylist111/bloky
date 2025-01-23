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

import { isDomainList, createSafeOriginUrl } from "./url";
import { type Command } from "./command-library.types";
import { isValidLicenseState } from "./license";
import {
  type ParamDefinitionList,
  type ParamValidator,
} from "./param-validator.types";

/**
 * Regular expression for checking if a string has a valid date shape
 */
const validDateRegExp = /^\d{4}-\d{1,2}-\d{1,2}$/;

/**
 * Checks whether the given parameter is of type number, and not NaN.
 *
 * @param param The parameter to validate
 * @returns Whether the parameter is numeric
 */
export const isNumeric: ParamValidator = (param) =>
  typeof param === "number" && !Number.isNaN(param);

/**
 * Checks whether the given parameter is of type string and not empty.
 *
 * @param param The parameter to check
 * @returns Whether the param is a string that's not empty
 */
export const isNotEmpty: ParamValidator = (param) =>
  typeof param === "string" && param.length > 0;

/**
 * Checks whether the given parameter is either not given or a positive number.
 *
 * @param param The parameter to check
 * @returns Whether the param is empty or a positive number
 */
export const isEmptyOrPositiveNumber: ParamValidator = (param) =>
  typeof param === "undefined" || (typeof param === "number" && param > 0);

/**
 * Checks whether the given parameter contains only values of type LicenseState.
 *
 * @param param The parameter to validate
 * @returns Whether the parameter contains only values of type LicenseState
 */
export const isValidLicenseStateList: ParamValidator = (
  param: unknown,
): boolean => {
  if (!param) {
    return true;
  }
  if (typeof param !== "string") {
    return false;
  }
  const licenseStates = param.split(",");
  return licenseStates.every((state) => isValidLicenseState(state));
};

/**
 * Checks whether the given parameter is a safe URL string.
 *
 * @param param The parameter to check
 * @returns whether the given parameter is a safe URL string
 */
export const isSafeUrl: ParamValidator = (param: unknown): boolean => {
  if (typeof param !== "string") {
    return false;
  }

  // We consider the URL safe if we can successfully create a URL
  // with a safe origin from it.
  const url = createSafeOriginUrl(param);
  return typeof url === "string";
};

/**
 * Validates a list of domains
 *
 * @param param The parameter to check
 * @returns whether the given parameter is a valid domain list
 */
export const isValidDomainList: ParamValidator = (param: unknown): boolean => {
  if (!param) {
    return true;
  }

  if (typeof param !== "string") {
    return false;
  }

  return isDomainList(param);
};

/**
 * Checks whether the given parameter is a date of type string
 * with the shape YYYY-MM-DD, YYYY-MM-D, YYYY-M-DD or YYYY-M-D
 *
 * @param param The parameter to check
 * @returns Whether the given parameter is a valid date string
 */
export const isValidDate: ParamValidator = (param: unknown): boolean => {
  if (!param) {
    return false;
  }

  if (typeof param !== "string") {
    return false;
  }

  if (!validDateRegExp.test(param)) {
    return false;
  }

  // Validating date shape is not enough, we need to verify
  // that a valid Date object can be created from it
  if (!Date.parse(param)) {
    return false;
  }

  return true;
};

/**
 * Validates the given command to check if the requirements for the
 * parameters are met. Will return an array containing one error message for
 * every invalid parameter, so that the length of the array is the number of
 * parameter validation errors.
 *
 * @param command The command to validate
 * @param paramDefinitions The definition for the expected params
 * @returns An array containing one error message for every invalid parameter
 */
export function validateParams<T>(
  command: Command,
  paramDefinitions: ParamDefinitionList<T>,
): string[] {
  return paramDefinitions
    .map((definition) => {
      // Typescript is considering `definition.name` to be of type
      // Symbol (keyof T), so we need to convert it into a string
      const name = String(definition.name);
      const param = command[name];
      return definition.validate(param)
        ? ""
        : `Invalid value for parameter "${name}", got "${String(param)}":`;
    })
    .filter((result) => result !== "");
}
