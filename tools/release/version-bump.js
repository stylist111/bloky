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

import { readFile, writeFile } from "fs/promises";
import path from "path";

import { projectRootPath, executeShellCommand } from "./utils.js";

export function updateVersionInConfigContent(content, version) {
  const regex = /("?version"?:\s*)"[^"]+"/;

  if (!regex.test(content)) {
    throw new Error("Could not find version field in the config file");
  }

  return content.replace(regex, '$1"' + version + '"');
}

export async function updateVersionInConfig(host, version) {
  let configPath;
  let needsPackageLockUpdate = false;

  switch (host) {
    case "adblock":
      configPath = "host/adblock/build/config/base.mjs";
      break;
    case "adblockplus":
      configPath = "host/adblockplus/build/webext/config/base.mjs";
      break;
    case "sdk":
      configPath = "core/sdk/package.json";
      needsPackageLockUpdate = true;
      break;
    default:
      throw new Error(`Host does not have a known config path: ${host}`);
  }

  const fullPath = path.join(projectRootPath(), configPath);
  const content = await readFile(fullPath, "utf8");
  const updatedContent = updateVersionInConfigContent(content, version);
  await writeFile(fullPath, updatedContent, "utf8");

  if (needsPackageLockUpdate) {
    await executeShellCommand("npm install --package-lock-only");
  }
}

const FEATURE_TITLE = /^feat(\([^)]*\))?!?:/;

export function bumpTypeForTitles(titles) {
  return titles.some((title) => FEATURE_TITLE.test(title)) ? "minor" : "patch";
}

export function bumpVersion(version, bumpType) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.\d+)?$/.exec(version);
  if (!match) {
    throw new Error(`Cannot parse version: ${version}`);
  }

  const [major, minor, patch] = match.slice(1, 4).map(Number);

  switch (bumpType) {
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${bumpType}`);
  }
}
