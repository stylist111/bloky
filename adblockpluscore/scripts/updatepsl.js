/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const {promises: {writeFile}} = require("fs");
const got = require("got");

const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const ICANN_PSL_FILENAME = "data/icannPublicSuffixList.js";
const NON_ICANN_PSL_FILENAME = "data/nonIcannPublicSuffixList.js";

async function main() {
  let response = await got(PSL_URL);
  let psl = {};
  let privatepsl = {};
  let isPrivateDomain = false;

  for (let line of response.body.split(/\r?\n/)) {
    if (line.startsWith("// ===BEGIN PRIVATE DOMAINS===")) {
      isPrivateDomain = true;
      continue;
    }
    else if (line.length == 0 || line.startsWith("//")) {
      continue;
    }

    let value = 1;
    line = line.replace(/\s+$/, "");

    if (line.startsWith("*.")) {
      line = line.slice(2);
      value = 2;
    }
    else if (line.startsWith("!")) {
      line = line.slice(1);
      value = 0;
    }
    let list = (isPrivateDomain ? privatepsl : psl);
    list[new URL("http://" + line).hostname] = value;
  }

  await writeFile(NON_ICANN_PSL_FILENAME, "exports.nonIcannPublicSuffixes = " +
    JSON.stringify(privatepsl, " ", 2));
  await writeFile(ICANN_PSL_FILENAME, "exports.icannPublicSuffixes = " +
    JSON.stringify(psl, " ", 2));
}

if (require.main == module) {
  main();
}
