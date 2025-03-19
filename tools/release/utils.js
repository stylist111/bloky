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
import url from "url";
import path from "path";
import {exec} from "child_process";
import {promisify} from "util";

export async function readFile(filePath) {
  return fs.promises.readFile(filePath, {encoding: "utf-8"});
}

export async function writeFile(filePath, contents) {
  return fs.promises.writeFile(
    filePath,
    contents,
    {
      encoding: "utf-8"
    }
  );
}

export function projectRootPath() {
  const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));  
  const projectRoot = path.join(scriptDir, "..", "..");  
  return path.normalize(projectRoot);
}

export async function executeShellCommand(command, cwd = projectRootPath()) {
  try {
    const { stdout } = await promisify(exec)(command, { cwd });
    return stdout.trim();
  } catch (error) {
    throw new Error(`${error.message}\nstdout: ${error.stdout}\nstderr: ${error.stderr}`);
  }
}

export async function gitRepoHasChanges(cwd = projectRootPath()) {
  let status = await executeShellCommand("git status --porcelain", cwd);
  return status != "";
}

export async function checkIfGitRefExists(ref) {
  try {
    await executeShellCommand(`git rev-parse --quiet --verify ${ref}^{commit}`);
    return true;
  } catch (e) {
    return false;
  }
}

// metaUrl from import.meta.url of the script in question.
export function getCurrentFileDir(metaUrl) {
  return path.dirname(url.fileURLToPath(metaUrl));
}
