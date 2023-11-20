/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import {exec} from "child_process";
import {promisify} from "util";

import {ReleaseNotes} from "./releaseNotes.js";
import {isMain, projectRootPath, currentVersion} from "./utils.js";
const isScriptInvokedFromCLI = isMain(import.meta.url);

async function run() {
  let releaseNotes = await ReleaseNotes.readFromDefaultFilepath();

  let version = await currentVersion();
  releaseNotes.insertNewVersionHeading(version, new Date());

  await releaseNotes.writeToDefaultFilepath();

  let projectRoot = projectRootPath();
  await promisify(exec)(
    `git add ${ReleaseNotes.defaultFilepath()}`,
    {cwd: projectRoot}
  );
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
