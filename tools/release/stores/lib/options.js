/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
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
 * Throws if any of the named options is missing, `null` or an empty string.
 *
 * Store credentials usually come from CI variables, and an unset variable
 * turns into `undefined` or `""`. Failing early with the option name is
 * clearer than an HTTP 401 from the store.
 *
 * @param {Record<string, unknown>|undefined} options Options object to check.
 * @param {string[]} names Names of the required options.
 * @param {string} context Name of the calling function, used in the message.
 * @throws {TypeError} If at least one required option is missing.
 */
export function requireOptions(options, names, context) {
  const missing = names.filter((name) => {
    const value = options?.[name];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new TypeError(
      `${context}: missing required option(s): ${missing.join(", ")}`,
    );
  }
}
