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

import {exec, spawn} from "child_process";
import {promisify} from "util";

import {ReleaseNotes} from "./releaseNotes.js";
import {isMain, projectRootPath, currentVersion, repositoryUrl}
  from "./utils.js";
const isScriptInvokedFromCLI = isMain(import.meta.url);

async function removeIncorrectFormatTag(version, projectRoot) {
  try {
    await promisify(exec)(
      `git tag --delete v${version}`,
      {cwd: projectRoot}
    );
  }
  catch (e) {
    console.warn("Failed to delete previous tag created by npm version");
    console.warn(`Error: ${e.toString()}`);
  }
}

async function createNewTag(version) {
  let releaseNotes = await ReleaseNotes.readFromDefaultFilepath();

  // exec doesn't provide a way to send stdin, which is the easiest way to pass
  // the release notes found for the release.
  let subprocess = spawn("git", [
    "tag", "--file=-", "--cleanup=whitespace", version
  ]);
  return new Promise((resolve, reject) => {
    subprocess.stdin.write(releaseNotes.notesForVersion(version));
    subprocess.stdin.end();

    let log = [];

    function removeListeners() {
      subprocess.stderr.off("data", onData);
      subprocess.stdout.off("data", onData);
      subprocess.off("close", onClose);
    }

    function onData(data) {
      log.push(data);
    }

    function onClose(code) {
      removeListeners();
      if (code == 0) {
        resolve();
      }
      else {
        console.error(log.join("\n"));
        reject(new Error("Failed to create tag for the version"));
      }
    }

    subprocess.stderr.on("data", onData);
    subprocess.stdout.on("data", onData);
    subprocess.on("close", onClose);
  });
}

async function run() {
  let projectRoot = projectRootPath();
  let version = await currentVersion();

  await removeIncorrectFormatTag(version, projectRoot);
  await createNewTag(version, projectRoot);

  let repoUrl = await repositoryUrl();
  console.log("The version has been updated, and the tag created!");
  console.log("Note that these have not been git pushed. Please review the new commit and tag before pushing them.");
  console.log();
  console.log(`Continue the release process here: ${repoUrl}/-/wikis/Release-process`);
  console.log(`Gitlab: ${repoUrl}/-/releases/new?tag_name=${version}`);
  console.log("Jira: https://jira.eyeo.com/projects/EE?selectedItem=com.atlassian.jira.jira-projects-plugin%3Arelease-page&status=released-unreleased");
  console.log();
}

if (isScriptInvokedFromCLI) {
  run().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
