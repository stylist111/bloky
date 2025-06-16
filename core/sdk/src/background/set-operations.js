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
 * A difference from arrays or filters.
 * @typedef {Object} FilterDiffs
 * @property {?string} type The type. Only the value "diff" is
 *   supported, and denote this is a difference from the static
 *   filtering rules.
 * @property {Array<string>} added Added filters.
 * @property {Array<string>} removed Removed filters.
 */

/**
 * Calculate the arrays difference
 *
 * @param {[string]} from The original array
 * @param {[string]} to The eventual array
 * @return {FilterDiffs}
 */
export function arraysDiff(from, to) {
  const fromSet = new Set(from);
  const toSet = new Set(to);

  // No longer listed in eventual array
  const removed = from.filter(item => !toSet.has(item));

  // Not yet listed in original array
  const added = to.filter(item => !fromSet.has(item));

  return {added, removed};
}

/**
 * Calculate the filters update difference by removing the base
 * from the update.
 *
 * @param {FilterDiffs} base The base diff, ie the state of the already
 *   applied update. Must be of type `diff`.
 * @param {FilterDiffs} update The update. Must be of type `diff`.
 * @return {FilterDiffs}
 * @throws {Error} Will throw an error if the updates are not of type
 *   "diff".
 */
export function filtersUpdateDiff(base, update) {
  let addedDiff = arraysDiff(base.added, update.added);
  let removedDiff = arraysDiff(base.removed, update.removed);

  // What is no longer removed must be added back.
  let added = addedDiff.added.concat(removedDiff.removed);

  // What is no longer added must be removed.
  let removed = removedDiff.added.concat(addedDiff.removed);

  return {added, removed};
}

/**
 * Merge objects. The merged object will have properties of both objects.
 * The arrays will also be merged.
 * @param {Object} obj1 Object 1 to merge
 * @param {Object} obj2 Object 2 to merge
 * @returns {Object} merged object
 */
export function mergeObjects(obj1, obj2) {
  if (obj1 instanceof Array) {
    return [...obj1, ...obj2];
  }

  if (!(obj1 instanceof Object)) {
    return obj2;
  }

  let resultObj = {};

  for (let [key, obj1Values] of Object.entries(obj1)) {
    resultObj[key] = obj1Values;
  }

  for (let [key, obj2Values] of Object.entries(obj2)) {
    let map1Values = resultObj[key];
    resultObj[key] = map1Values ?
      mergeObjects(map1Values, obj2Values) :
      obj2Values;
  }

  return resultObj;
}

/**
 * Converts number to bytes array
 *
 * @param {number} num - Number to convert
 * @returns {Uint8Array} bytes array
 */
function bnToBytes(num) {
  let hex = num.toString(16);
  if (hex.length % 2) {
    hex = `0${hex}`;
  }

  const length = hex.length / 2;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Encodes an array of numbers to a base64-encoded bitmap.
 * For every truthy value in the array, a bit is set to 1, and for every falsy
 * value, a bit is set to 0. The bits are then packed into bytes and
 * converted to a base64-encoded string.
 * @link https://eyeo.atlassian.net/browse/DATA-2793
 *
 * @param {Array<number>} toEncode - Array of objects to encode
 * @returns {string} base64-encoded bitmap
 */
export function base64Encode(toEncode) {
  let bitmap = 0n;

  for (const value of [...toEncode].reverse()) {
    bitmap |= value ? 1n : 0n;
    bitmap <<= 1n;
  }
  bitmap >>= 1n;

  const bytes = bnToBytes(bitmap);
  return btoa(String.fromCharCode(...bytes));
}
