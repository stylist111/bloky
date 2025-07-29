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

import { promises as fs } from "fs";
import path from "path";
import url from "url";

import * as fsh from "./fs-helper.js";

async function buildTypes(hostname) {
  const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
  const inputFile = path.join(scriptDir, "..", "types", "index.d.ts");
  const outputFile = await fsh.getDistPath(hostname, "index.d.ts");

  await fs.copyFile(inputFile, outputFile);
  console.log("Created type definition files", outputFile);
}

await Promise.all([buildTypes("adblock"), buildTypes("adblockplus")]);
