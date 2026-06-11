/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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
 * Compile-time exhaustiveness check for discriminated unions.
 *
 * Call inside a `default:` branch to force TypeScript to error when the
 * union gains a new variant that the switch doesn't handle. The `never`
 * parameter type is what triggers the error — if `value` isn't
 * statically `never`, the call site is missing a case.
 *
 * @example
 * switch (action.type) {
 *   case DialogAction.CLOSE: ...; break;
 *   case DialogAction.NAVIGATE: ...; break;
 *   case DialogAction.END_TRIAL: ...; break;
 *   default: assertExhaustive(action);
 * }
 */
export function assertExhaustive(value: never): never {
  throw new Error(
    `Unhandled discriminated-union variant: ${JSON.stringify(value)}`,
  );
}
