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

/* eslint-env node */

import fs from "fs";
import path from "path";

export async function cleanup() {
  for (let item of ["scriptsOutput"]) {
    let pathToRemove = path.join(process.cwd(), item);
    if (fs.existsSync(pathToRemove))
      await fs.promises.rm(pathToRemove, {recursive: true});
  }
}

if (import.meta.url.endsWith("clean-mv3-files.js"))
  cleanup();
