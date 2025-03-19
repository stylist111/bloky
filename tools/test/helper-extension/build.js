/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const srcPath = path.dirname(fileURLToPath(import.meta.url));

export async function buildHelperExtension(manifestVersion, destPath) {
  if (manifestVersion !== "2" && manifestVersion !== "3")
    throw new Error('manifestVersion must be "2" or "3". ' + `Current: "${manifestVersion}"`);

  await fs.promises.rm(destPath, { recursive: true, force: true });
  await fs.promises.mkdir(destPath, { recursive: true });

  const manifestBase = path.join(srcPath, "manifest.base.json");
  const manifest = JSON.parse(await fs.promises.readFile(manifestBase));

  manifest.name = `${manifest.name} MV${manifestVersion}`;
  manifest["manifest_version"] = parseInt(manifestVersion, 10);
  manifest.background =
    manifestVersion === "2" ? { scripts: ["background.js"] } : { service_worker: "background.js" };

  await fs.promises.writeFile(
    path.join(destPath, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  await fs.promises.copyFile(
    path.join(srcPath, "background.js"),
    path.join(destPath, "background.js"),
  );
}
