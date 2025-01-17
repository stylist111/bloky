#!/usr/bin/env node

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

/* This script will generate 100 random URL filters to populate data
 * for testing. */

/* eslint no-console: "off" */

import {randomInteger} from "adblockpluscore/lib/random.js";

/**
 * Generate a random string.
 * @param {number} length The length of the string wanted.
 * @returns {String} A random string.
 */
function randomString(length) {
  const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
  const NUM_CHARS = CHARS.length;

  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(randomInteger(0, NUM_CHARS));
  }

  return result;
}

for (let i = 0; i < 100; i++) {
  /* Get a random length of at least 5 */
  let length = randomInteger(5, 17);
  let random = randomString(length);
  console.log(`||${random}.invalid^`);
}
