/*
 * This file is part of @eyeo/rules-utils <https://adblock.org/>,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * @eyeo/rules-utils is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * @eyeo/rules-utils is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @eyeo/rules-utils.  If not, see <http://www.gnu.org/licenses/>.
 */

import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function execNpm(cmd, ...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject("Received error code");
      }
    });
    proc.on("error", reject);

    proc.stdout.on("data", (data) => console.log(data.toString()));
    proc.stderr.on("data", (data) => console.error(data.toString()));
  });
}

export async function importJson(filepath) {
  const content = await readFile(resolvePath(filepath), "utf8");
  return JSON.parse(content);
}

export function resolvePath(filepath) {
  return require.resolve(filepath);
}
