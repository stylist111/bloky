/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from "path";

// Path to end-to-end test code
const endToEndPath = process.cwd();

export const runnerConfig = {
  // The browser name to use for the tests
  browserName: process.env.BROWSER,
  // The manifest version passed as command line argument
  manifestVersion: process.env.MANIFEST_VERSION,
  // Screenshots folder path
  screenshotsPath: path.join(endToEndPath, "screenshots"),
  // Runners path
  runnersPath: path.join(endToEndPath, "runner.js"),
  // Path to build the helper extension
  helperExtensionPath: path.join(process.cwd(), "dist/devenv/helper-extension"),
  // Path to the unpacked extension
  unpackedDirPath: path.join(process.cwd(), "test-extension/dist"),
};
