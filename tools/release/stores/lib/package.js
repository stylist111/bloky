/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
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

// Locates and checks the release packages that the store uploads send.

import { execFile } from "child_process";
import { openAsBlob } from "fs";
import path from "path";
import { promisify } from "util";

import { projectRootPath } from "../../utils.js";

/**
 * Returns the path of a host's Chrome (mv3) release package, as built by
 * the `build:release` CI job. The Chrome Web Store and Microsoft Edge
 * Add-ons both take this package.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {string} version Version being released, e.g. `4.46.0`.
 * @param {string} [rootPath] Repository root. Defaults to this repository.
 * @returns {string} Absolute path, e.g.
 *   `<root>/host/adblockplus/dist/release/adblockplus-chrome-4.46.0-mv3.zip`.
 */
export function chromePackagePath(host, version, rootPath = projectRootPath()) {
  return path.join(
    rootPath,
    "host",
    host,
    "dist",
    "release",
    `${host}-chrome-${version}-mv3.zip`,
  );
}

/**
 * Reads the version from `manifest.json` inside a package, with the `unzip`
 * command like the `check-source:manifest` CI jobs do.
 *
 * @param {string} packagePath Path of the zip.
 * @returns {Promise<string>} The manifest's `version`.
 * @throws {Error} If `unzip` fails, e.g. because the file doesn't exist or
 *   isn't a zip, or if `manifest.json` has no version.
 */
export async function readManifestVersion(packagePath) {
  const { stdout } = await promisify(execFile)(
    "unzip",
    ["-p", packagePath, "manifest.json"],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const { version } = JSON.parse(stdout);

  if (typeof version !== "string") {
    throw new Error("manifest.json has no version");
  }

  return version;
}

/**
 * Checks that a package contains the version being released.
 *
 * Stores process release-sized packages in the background and then don't
 * report their version, so this has to be checked before uploading.
 *
 * @param {string} packagePath Path of the zip.
 * @param {string} version Version being released.
 * @param {(path: string) => Promise<string>} [readVersion] Reads the
 *   version from the package. Defaults to `readManifestVersion()`.
 * @throws {Error} If the version can't be read or doesn't match.
 */
export async function checkPackageVersion(
  packagePath,
  version,
  readVersion = readManifestVersion,
) {
  let packageVersion;
  try {
    packageVersion = await readVersion(packagePath);
  } catch (error) {
    throw new Error(
      `Can't read the version from ${packagePath}: ${error.message}`,
      { cause: error },
    );
  }

  if (packageVersion !== version) {
    throw new Error(
      `${packagePath} contains version ${packageVersion}, ` +
        `but ${version} is being released. Not uploading.`,
    );
  }
}

/**
 * Reads a package for uploading.
 *
 * @param {string} packagePath Path of the zip.
 * @param {(path: string) => Promise<Blob>} [readPackage] Reads the file.
 *   Defaults to `fs.openAsBlob`.
 * @returns {Promise<Blob>} The package.
 * @throws {Error} If the file can't be read. The original error is
 *   available as `cause`.
 */
export async function readPackageFile(packagePath, readPackage = openAsBlob) {
  try {
    return await readPackage(packagePath);
  } catch (error) {
    throw new Error(
      `Can't read the package at ${packagePath}: ${error.message}`,
      { cause: error },
    );
  }
}
