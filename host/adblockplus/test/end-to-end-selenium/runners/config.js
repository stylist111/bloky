/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

import path from "path";
import { installUrl } from "../utils/urls.js";

// Path to end to end test code
const endToEndPath = path.join(process.cwd(), "test", "end-to-end-selenium");
// Path to extension zip files from the current build
const buildsDirPath = path.join(process.cwd(), "dist", "release");
// Path to downloaded extension zip files from the latest released build
const liveBuildsDirPath = path.join(process.cwd(), "dist", "live");
// Name of the host extension folder in /hosts
const hostname = "adblockplus";

export const runnerConfig = {
  // The browser name to use for the tests
  browserName: process.env.BROWSER,
  // The manifest version passed as command line argument
  manifestVersion: process.env.MANIFEST_VERSION,
  // Screenshots folder path
  screenshotsPath: path.join(endToEndPath, "screenshots"),
  // Runners path
  runnersPath: path.join(endToEndPath, "runners", "runner.*.js"),
  // Path to build the helper extension
  helperExtensionPath: path.join(
    process.cwd(),
    "dist",
    "devenv",
    "helper-extension"
  ),
  buildsDirPath,
  // Path to the unpacked extension
  unpackedDirPath: path.join(buildsDirPath, `${hostname}-unpacked`),
  liveBuildsDirPath,
  // Path to the unpacked upgrade extension
  unpackedUpgradeDirPath: path.join(
    liveBuildsDirPath,
    `${hostname}-upgrade-unpacked`
  ),
  hostname,
  installUrl
};
