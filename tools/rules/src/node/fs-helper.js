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

import { resolvePath } from "./utils.js";

import * as adblockConfig from "../../config/adblock.js";
import * as adblockplusConfig from "../../config/adblockplus.js";

const dataPath = path.dirname(resolvePath("@eyeo/filterlists/filterlists/"));
const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.join(scriptDir, "..", "..");
const distPath = path.join(rootDirectory, "dist", "%ADDON%");

export const indexSelected = path.join("index", "%ADDON%.json");
export const manifestFragment = path.join("manifest", "%ADDON%.json");
export const rulesAbp = path.join("rules", "abp");
export const rulesDnr = path.join("rules", "dnr");

export function getAddonPath(addonName, fileReference) {
  return fileReference.replaceAll("%ADDON%", addonName);
}

export async function clean(hostname) {
  try {
    await fs.rm(getAddonPath(hostname, distPath), { recursive: true });
  } catch (ex) {
    // Ignore if directory doesn't exist yet
  }
}

export async function getConfig(hostname) {
  if (hostname === "adblock") {
    return adblockConfig;
  }

  if (hostname === "adblockplus") {
    return adblockplusConfig;
  }

  throw new Error(`Unknown hostname: ${hostname}`);
}

async function prepareDirectory(hostname, basePath, fileReference) {
  const absolutePath = getAddonPath(
    hostname,
    path.join(basePath, fileReference),
  );
  const dirPath = path.extname(absolutePath)
    ? path.dirname(absolutePath)
    : absolutePath;

  try {
    await fs.access(dirPath);
  } catch (ex) {
    if (ex.code !== "ENOENT") {
      console.error(ex);
      throw ex;
    }

    await fs.mkdir(dirPath, { recursive: true });
  }

  return absolutePath;
}

export async function readJson(filepath) {
  const content = await fs.readFile(filepath, "utf8");
  return JSON.parse(content);
}

export const getDataPath = () => {
  return dataPath;
};

export const getDistPath = (hostname, fileReference) => {
  return prepareDirectory(hostname, distPath, fileReference);
};
