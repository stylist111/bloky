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

import {projectRootPath} from "./utils.js";

export class ReleaseNotes {
  constructor(fileContent) {
    this.lines = fileContent.split("\n");
  }

  toString() {
    return this.lines.join("\n");
  }

  notesForVersion(version) {
    const start = this.lines.findIndex((currentLine) => {
      const line = currentLine.toLowerCase();
      const headingStart = "# " + version.toLowerCase();
      
      return line.startsWith(headingStart + " ") || line == headingStart;
    });
      
    if (start < 0) {
      throw new Error(`Could not find notes for version ${version}`);
    }

    let end = this.lines.findIndex((line, index) => {
      if (index <= start) {
        return false;
      }

      return line.startsWith("# ");
    });

    if (end < 0) {      
      end = this.lines.length;
    }

    return this.lines.slice(start, end).join("\n").trim();
  }

  unreleasedNotes() {
    return this.notesForVersion("unreleased");
  }

  hasUnreleasedNotes() {
    const unreleasedNotes = this.unreleasedNotes();
    return /^# unreleased$/i.test(unreleasedNotes);
  }

  insertNewVersionHeading(version, now) {
    let unreleasedLine = this.lines.findIndex((currentLine) => {
      const line = currentLine.toLowerCase();
      const headingStart = "# unreleased";
            
      return line.startsWith(headingStart + " ") || line == headingStart;
    });

    let newHeadingLine = unreleasedLine >= 0 ? unreleasedLine + 1 : 0;

    let date = now.toISOString().substring(0, 10);
    let versionHeading = `# ${version} - ${date}`;

    let newHeading = [
      "",
      versionHeading
    ];

    this.lines.splice(newHeadingLine, 0, ...newHeading);

    let expectedWhitespaceLine = newHeadingLine + newHeading.length;
    if (this.lines[expectedWhitespaceLine].trim() != "") {
      this.lines.splice(expectedWhitespaceLine, 0, "");
    }
  }

  async writeToHostFilepath(host) {
    await writeFile(
      ReleaseNotes.hostFilePath(host),
      this.toString(),
      "utf8"
    );
  }
}

ReleaseNotes.hostFilePath = function(host) {
  switch (host) {
    case "adblock":
      return path.join(projectRootPath(), 'host', 'adblock', 'RELEASE_NOTES.md');
    case "adblockplus":
      return path.join(projectRootPath(), 'host', 'adblockplus', 'RELEASE_NOTES.md');
    case "sdk":
      return path.join(projectRootPath(), 'core', 'sdk', 'RELEASE_NOTES.md');
    default:
      throw new Error(`Unknown host: ${host}`);
  }
};

ReleaseNotes.readFromHostFilepath = async function(host) {
  let releaseNotesContent = await readFile(ReleaseNotes.hostFilePath(host), "utf8");
  return new ReleaseNotes(releaseNotesContent);
};
