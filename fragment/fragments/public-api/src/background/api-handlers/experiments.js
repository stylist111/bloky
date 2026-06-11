/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

/**
 * Exposes all current experiment flags and their values.
 * @returns {Promise<Object>} An object with all experiment flag IDs and their values.
 */
export async function getExperimentFlags() {
  return ewe.experiments.getFlags();
}

/**
 * Retrieves current experiment variant assignments
 * @returns {Promise<Object.<string, string>>} Object specifying the assigned
 *   variant ID for each active assigned experiment ID
 */
export async function getExperimentAssignments() {
  return ewe.experiments.getAssignments();
}
