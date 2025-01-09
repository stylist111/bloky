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

/* eslint-env node */

import {spawn} from "child_process";
import fs from "fs";
import path from "path";

export function getTestPaths(testPaths, recurse) {
  let testFiles = [];

  for (let testPath of testPaths) {
    let stat = fs.statSync(testPath);
    if (stat.isDirectory()) {
      if (recurse) {
        testFiles = testFiles.concat(getTestPaths(fs.readdirSync(testPath).map(
          file => path.join(testPath, file))
        ));
      }
      continue;
    }
    if (path.basename(testPath).startsWith("_")) {
      continue;
    }
    if (path.extname(testPath) == ".js") {
      testFiles.push(testPath);
    }
  }

  return testFiles;
}

export function spawnScript(name, ...args) {
  return new Promise((resolve, reject) => {
    let script = spawn("npm",
                       ["run", name, ...args],
                       {stdio: ["inherit", "inherit", "inherit"]});
    script.on("error", reject);
    script.on("close", code => {
      if (code == 0) {
        resolve();
      }
      else {
        reject();
      }
    });
  });
}
