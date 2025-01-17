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

/** @module */

"use strict";

const toLocalISODateString =
/**
 * Formats only the date portion in ISO format (YYYY-MM-DD).
 *
 * Differs from Date.prototype.toISOString() in that it uses the local timezone
 * to determine the date, and does not include the time portion in the result.
 *
 * @param {Date} date date to be formatted
 * @return {String} date string in the format YYYY-MM-DD
 */
exports.toLocalISODateString = function(date) {
  let year = String(date.getFullYear()).padStart(4, "0");
  let month = String(date.getMonth() + 1).padStart(2, "0");
  let day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Formats only the date portion in ISO format (YYYY-MM-DD), using the passed in
 * cutoff time instead of midnight as the boundary between days.
 *
 * @param {Date} date Date to be formatted
 * @param {number} dayCutoffMinutes Number of minutes after midnight in the
 *   local timezone which shold be used as the boundary between days instead of
 *   midnight.
 * @return {String} Date string in the format YYYY-MM-DD
 */
exports.toLocalISODateStringWithCutoffTime = function(date, dayCutoffMinutes) {
  let timeOfDay = date.getHours() * 60 + date.getMinutes();
  let dayBucket = date;
  if (timeOfDay < dayCutoffMinutes) {
    dayBucket.setDate(dayBucket.getDate() - 1);
  }

  return toLocalISODateString(dayBucket);
};
