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

/**
 * A difference from filters.
 * @typedef {Object} FilterDiffs
 * @property {?string} type The type. Only the value "diff" is
 *   supported, and denote this is a difference from the static
 *   filtering rules.
 * @property {Array<string>} added Added filters.
 * @property {Array<string>} removed Removed filters.
 */

/**
 * Calculate the difference by removing the base
 * from the update.
 *
 * @param {FilterDiffs} base The base diff, ie the state of the already
 *   applied update. Must be of type `diff`.
 * @param {FilterDiffs} update The update. Must be of type `diff`.
 * @return {FilterDiffs}
 * @throws {Error} Will throw an error if the updates are not of type
 *   "diff".
 */
export function calculateDiff(base, update) {
  let updateAdded = new Set(update.added);
  let updateRemoved = new Set(update.removed);
  let baseAdded = new Set(base.added);
  let baseRemoved = new Set(base.removed);

  // Symmetric difference of the added sets.
  base.added.forEach(element => {
    if (updateAdded.has(element)) {
      updateAdded.delete(element);
      baseAdded.delete(element);
    }
  });
  // Symmetric difference of the removed sets.
  base.removed.forEach(element => {
    if (updateRemoved.has(element)) {
      updateRemoved.delete(element);
      baseRemoved.delete(element);
    }
  });

  // What is no longer removed must be added back.
  let added = [...updateAdded.keys()].concat(...baseRemoved.keys());

  // What is no longer added must be removed.
  let removed = [...updateRemoved.keys()].concat(...baseAdded.keys());

  return {added, removed};
}
