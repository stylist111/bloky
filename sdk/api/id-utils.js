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

// Chromium supports 31 bits per rule id

// max value for DNR rule index
export const INDEX_MAX = 2000;

export function encode(
  index,  /* Can be in range of 0-`INDEX_MAX`
             Also we add 1, the higher range value is `INDEX_MAX`-1 */
  line) { // Can be in range of 0-Math.floor((2^31 - 1)/INDEX_MAX)-1 only
  // add 1 as Chromium requires rule id to start from 1
  return 1 + index + line * INDEX_MAX;
}

export function decode(ruleId) {
  // Reduce 1 as Chromium requires rule id to start from 1
  // and we've added 1 while encoding
  ruleId -= 1;
  let index = ruleId % INDEX_MAX;
  let line = Math.floor(ruleId / INDEX_MAX);
  return {index, line};
}
