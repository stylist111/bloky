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

/**
 * Generates a random integer between min (inclusive) and max (exclusive).
 *
 * @param {number} min The minimum integer to generate (inclusive).
 * @param {number} max The maximum integer to generate (exclusive).
 * @return {number} A random integer between min and max
 */
exports.randomInteger = function(min, max) {
  if (min > max) {
    throw new Error("Cannot generate random integer in range, " +
      `min (${min}) must be less than max (${max})`);
  }

  let range = max - min;
  return Math.floor(Math.random() * range + min);
};
