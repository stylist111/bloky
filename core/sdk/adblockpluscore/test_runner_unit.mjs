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

import path from "path";
import {fileURLToPath} from "url";

import {getTestPaths, spawnScript} from "./test/_utils.mjs";

let dirname = path.dirname(fileURLToPath(import.meta.url));

(async function() {
  let paths = process.argv.length > 2 ? process.argv.slice(2) :
                [path.join(dirname, "test"),
                 path.join(dirname, "test", "scripts")];
  let unitFiles = getTestPaths(paths, true);

  try {
    if (unitFiles.length == 0) {
      throw new Error("Unit files length was 0");
    }

    await spawnScript("unit-tests", ...unitFiles);
  }
  catch (error) {
    if (error) {
      console.error(error);
    }

    process.exit(1);
  }
})();
