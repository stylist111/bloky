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

import { download } from "@eyeo/get-browser-binary";

/**
 * Finds the project root directory by looking for a package.json file.
 *
 * @param {string} [startDir] - The directory to start looking in
 * @param {string} [lookupFile="package.json"] - The file to look for in the directory
 * @returns {string|*}
 */
export function findProjectRoot(startDir = process.cwd(), lookupFile = "package.json") {
  // Convert the directory to an absolute path, and resolve the lookup file path.
  const dir = path.resolve(startDir);

  if (fs.existsSync(path.resolve(dir, lookupFile))) {
    return dir;
  }

  const parentDir = path.dirname(dir);
  if (parentDir === dir) {
    throw new Error("Project root not found");
  }

  return findProjectRoot(parentDir);
}

/**
 * Downloads the latest release builds from Gitlab
 *
 * @param {string} extName - The name of the extension e.g. adblock or adblockplus
 * @param {string} browserName - The name of the browser
 * @param {number|string} manifestVersion - The manifest version
 * @param {string} outputDirPath - The path to the directory to save the builds
 * @returns {Promise<void>}
 */
export async function downloadLatestReleaseBuilds({
  extName,
  browserName = "chrome",
  manifestVersion = 3,
  outputDirPath,
}) {
  // make sure that the output directory exists
  await fs.promises.mkdir(outputDirPath, { recursive: true });

  const res = await fetch("https://gitlab.com/api/v4/projects/59518842/releases");
  if (!res.ok) {
    throw new Error(`Failed to fetch to Gitlab Releases API: ${res.statusText}`);
  }

  const releases = await res.json();
  if (releases.length === 0) {
    throw new Error("No releases found");
  }

  let latestRelease = null;
  for (const release of releases) {
    // if not an adblock release, skip
    if (!release.tag_name.startsWith(`${extName}-`)) {
      continue;
    }

    // if first adblock release, set it as latest
    if (!latestRelease) {
      latestRelease = release;
      continue;
    }

    // if release date is newer than latest adblock release, set it as latest
    const releaseDate = new Date(release.created_at);
    if (releaseDate > new Date(latestRelease.created_at)) {
      latestRelease = release;
    }
  }

  if (!latestRelease) {
    throw new Error(`No releases found for extension "${extName}"`);
  }

  const promises = [];
  for (const { name, url } of latestRelease.assets.links) {
    if (name.includes(browserName) && name.includes(`mv${manifestVersion}`)) {
      console.log(`Downloading ${url} ...`); // eslint-disable-line no-console
      promises.push(download(url, path.join(outputDirPath, name)));
    }
  }
  await Promise.all(promises);
}
