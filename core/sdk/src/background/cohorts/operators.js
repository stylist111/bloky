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
 * Cohorts operator for relative time comparisons. Checks if a fact value is
 * older than a specified time in milliseconds.
 *
 * @ignore
 * @param {number} factValue - The fact value to compare, typically a timestamp.
 *    e.g. installDate
 * @param {number} jsonValue - The time in milliseconds to compare against.
 * @returns {boolean}
 */
export function olderThan(factValue, jsonValue) {
  return factValue < (Date.now() - jsonValue);
}

/**
 * Cohorts operator for relative time comparisons. Checks if a fact value is
 * within the last specified time in milliseconds.
 *
 * @param {number} factValue - The fact value to compare, typically a timestamp.
 *    e.g. installDate
 * @param {number} jsonValue - The time in milliseconds to compare against.
 * @returns {boolean}
 */
export function withinLast(factValue, jsonValue) {
  return factValue >= (Date.now() - jsonValue);
}

/**
 * Checks if the factValue is greater than the jsonValue (semver).
 * @param {string} factValue - The semantic version to compare.
 * @param {string} jsonValue - The semantic version to compare against.
 * @returns {boolean}
 */
export function semverGreaterThan(factValue, jsonValue) {
  // eslint-disable-next-line no-warning-comments
  // TODO: Implement using semver.gt
  return false;
}

/**
 * Checks if the factValue is greater than or equal to the jsonValue (semver).
 * @param {string} factValue - The semantic version to compare.
 * @param {string} jsonValue - The semantic version to compare against.
 * @returns {boolean}
 */
export function semverGreaterThanEqual(factValue, jsonValue) {
  // eslint-disable-next-line no-warning-comments
  // TODO: Implement using semver.gte
  return false;
}

/**
 * Checks if the factValue is less than the jsonValue (semver).
 * @param {string} factValue - The semantic version to compare.
 * @param {string} jsonValue - The semantic version to compare against.
 * @returns {boolean}
 */
export function semverLessThan(factValue, jsonValue) {
  // eslint-disable-next-line no-warning-comments
  // TODO: Implement using semver.lt
  return false;
}

/**
 * Checks if the factValue is less than or equal to the jsonValue (semver).
 * @param {string} factValue - The semantic version to compare.
 * @param {string} jsonValue - The semantic version to compare against.
 * @returns {boolean}
 */
export function semverLessThanEqual(factValue, jsonValue) {
  // eslint-disable-next-line no-warning-comments
  // TODO: Implement using semver.lte
  return false;
}

/**
 * Checks if the factValue satisfies the semver range specified by jsonValue.
 * @param {string} factValue - The semantic version to check.
 * @param {string} jsonValue - The semver range to satisfy.
 * @returns {boolean}
 */
export function semverSatisfies(factValue, jsonValue) {
  // eslint-disable-next-line no-warning-comments
  // TODO: Implement using semver.satisfies
  return false;
}
