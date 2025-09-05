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
 * @typedef {Object} PerformanceMark
 * @property {string} name The name assigned to the mark when performance.mark
 * was called
 * @property {number} startTime Time in milliseconds that the mark was created,
 * relative to performance.timeOrigin.
 */

/**
 * @typedef {Object} PerformanceMeasure
 * @property {string} name The name assigned to the mark when performance.mark
 * was called
 * @property {number} startTime Timein milliseconds that the mark was created,
 * relative to performance.timeOrigin.
 * @property {number} duration Duration of the measurement in milliseconds.
 */

/**
 * @typedef {Object} PerformanceTimings
 * @property {PerformanceMark[]} marks Individual points along a timeline
 * @property {PerformanceMeasure[]} measures Durations that certain activities
 * took
 */

/**
 * Gets all of the profiling information recorded using `performance.mark()` and
 * `performance.measure()`
 *
 * @returns {PerformanceTimings} All performance marks and measurements since
 * startup.
 */
export function getPerformanceTimings() {
  return {
    marks: performance.getEntriesByType("mark").map(entry => {
      return {
        name: entry.name,
        startTime: entry.startTime
      };
    }),
    measures: performance.getEntriesByType("measure").map(entry => {
      return {
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration
      };
    })
  };
}
