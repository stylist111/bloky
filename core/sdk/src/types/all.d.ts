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

declare module "@eyeo/webext-ad-filtering-solution/all/profiling.js" {
  /** The name assigned to the mark when performance.mark was called */
  interface PerformanceMark {
    /** The name assigned to the mark when performance.mark was called */
    name: string;
    /** Time in milliseconds that the mark was created, relative to performance.timeOrigin. */
    startTime: number;
  }

  interface PerformanceMeasure {
    /** The name assigned to the mark when performance.mark was called */
    name: string;
    /** Time in milliseconds that the mark was created, relative to performance.timeOrigin. */
    startTime: number;
    /** Duration of the measurement in milliseconds. */
    duration: number;
  }

  interface PerformanceTimings {
    /** Individual points along a timeline */
    marks: PerformanceMark[];
    /** Durations that certain activities took */
    measures: PerformanceMeasure[];
  }

  /**
   * Gets all of the profiling information recorded using `performance.mark()` and
   * `performance.measure()`
   */
  const getPerformanceTimings: () => PerformanceTimings;
}
