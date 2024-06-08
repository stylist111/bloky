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

import {readFile, writeFile} from "fs/promises";
import path from "path";

import {randomInteger} from "adblockpluscore/lib/random.js";

import {projectRootPath} from "./utils.js";

function chooseEmoji() {
  // https://www.compart.com/en/unicode/block/U+1F300
  let codePoint = randomInteger(0x1F300, 0x1F600);
  return String.fromCodePoint(codePoint);
}

function isUnderline(line) {
  return line && /^=+$/.test(line.trim());
}

export class ReleaseNotes {
  constructor(fileContent) {
    this.lines = fileContent.split("\n");
  }

  insertNewVersionHeading(version, now, emoji = chooseEmoji()) {
    let unreleasedLine = this.lines.findIndex((line, index, allLines) => {
      let nextLine = allLines[index + 1];
      if (!isUnderline(nextLine)) {
        return false;
      }
      return line.trim().toLowerCase().includes("unreleased");
    });

    let newHeadingLine = 0;
    if (unreleasedLine >= 0) {
      newHeadingLine = unreleasedLine + 2;
    }

    let date = now.toISOString().substring(0, 10);
    let versionHeading = `${emoji} ${version} - ${date} ${emoji}`;

    let newHeading = [
      "",
      versionHeading,
      "=".repeat(versionHeading.length)
    ];

    this.lines.splice(newHeadingLine, 0, ...newHeading);

    let expectedWhitespaceLine = newHeadingLine + newHeading.length;
    if (this.lines[expectedWhitespaceLine].trim() != "") {
      this.lines.splice(expectedWhitespaceLine, 0, "");
    }
  }

  toString() {
    return this.lines.join("\n");
  }

  unreleasedNotes() {
    return this.notesForVersion("unreleased");
  }

  notesForVersion(version) {
    let start = this.lines.findIndex((line, index, allLines) => {
      let nextLine = allLines[index + 1];
      if (!isUnderline(nextLine)) {
        return false;
      }
      return line.trim().toLowerCase().includes(version);
    });

    if (start < 0) {
      throw new Error(`Could not find notes for version ${version}`);
    }

    let end = this.lines.findIndex((line, index, allLines) => {
      if (index <= start) {
        return false;
      }

      let nextLine = allLines[index + 1];
      if (!isUnderline(nextLine)) {
        return false;
      }

      return line.trim().length > 0;
    });

    if (end < 0) {
      end = this.lines.length;
    }

    return this.lines.slice(start, end).join("\n").trim();
  }

  async writeToDefaultFilepath() {
    await writeFile(
      ReleaseNotes.defaultFilepath(),
      this.toString(),
      {
        encoding: "utf-8"
      }
    );
  }
}

ReleaseNotes.defaultFilepath = function() {
  return path.join(projectRootPath(), "RELEASE_NOTES.md");
};

ReleaseNotes.readFromDefaultFilepath = async function() {
  let releaseNotesContent = await readFile(ReleaseNotes.defaultFilepath(), {
    encoding: "utf-8"
  });
  return new ReleaseNotes(releaseNotesContent);
};

