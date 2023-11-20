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

import expect from "expect";
import {ReleaseNotes} from "../../scripts/releaseNotes.js";

const NORMAL_FILE_LINES = [
  "This is maybe some preamble, which could be explaining the headings like ",
  "unreleased",
  "",
  "Unreleased",
  "==========",
  "",
  "- Did some stuff",
  "",
  "🎃 1.1.0 - 2023/10/10 🎃",
  "========================",
  "",
  "- Did some other stuff",
  "- And another thing",
  "",
  "🚀 1.0.0 - 2023/09/21 🚀",
  "========================",
  "",
  "- Would you believe it, more stuff!",
  ""
];
const NORMAL_FILE = NORMAL_FILE_LINES.join("\n");

const NO_WHITESPACE_LINES = NORMAL_FILE_LINES.filter(l => l.length > 0);
const NO_WHITESPACE = NO_WHITESPACE_LINES.join("\n");

describe("ReleaseNotes script", function() {
  it("can read and then return an arbitrary file", function() {
    let releaseNotes = new ReleaseNotes(NORMAL_FILE);
    expect(releaseNotes.toString()).toEqual(NORMAL_FILE);
  });

  describe("inserting a new version heading", function() {
    it("inserts the new heading such that unreleased notes become the new version's notes", function() {
      let releaseNotes = new ReleaseNotes(NORMAL_FILE);
      let previousUnreleasedNotes = releaseNotes.unreleasedNotes();

      releaseNotes.insertNewVersionHeading("1.2.0", new Date("2023-11-15"), "🍂");

      let unreleasedHeading = NORMAL_FILE_LINES.slice(3, 5).join("\n");

      let expectedNotes = previousUnreleasedNotes.replace(
        unreleasedHeading,
        "🍂 1.2.0 - 2023-11-15 🍂\n========================"
      );

      expect(releaseNotes.unreleasedNotes())
        .toEqual(unreleasedHeading);
      expect(releaseNotes.notesForVersion("1.2.0"))
        .toEqual(expectedNotes);
    });

    it("inserts a new line after the heading, even if the unreleased heading didn't have one", function() {
      let releaseNotes = new ReleaseNotes(NO_WHITESPACE);
      let previousUnreleasedNotes = releaseNotes.unreleasedNotes();

      releaseNotes.insertNewVersionHeading("1.2.0", new Date("2023-11-15"), "🍂");

      let unreleasedHeading = NO_WHITESPACE_LINES.slice(2, 4).join("\n");

      let expectedNotes = previousUnreleasedNotes.replace(
        unreleasedHeading,
        "🍂 1.2.0 - 2023-11-15 🍂\n========================\n"
      );

      expect(releaseNotes.unreleasedNotes())
        .toEqual(unreleasedHeading);
      expect(releaseNotes.notesForVersion("1.2.0"))
        .toEqual(expectedNotes);
    });
  });

  describe("getting notes for a specific version", function() {
    it("can get the unreleased notes from a normal file", function() {
      let releaseNotes = new ReleaseNotes(NORMAL_FILE);
      expect(releaseNotes.unreleasedNotes())
        .toEqual(NORMAL_FILE_LINES.slice(3, 7).join("\n"));
    });

    it("can get the release notes for a version in the middle of a normal file", function() {
      let releaseNotes = new ReleaseNotes(NORMAL_FILE);
      expect(releaseNotes.notesForVersion("1.1.0"))
        .toEqual(NORMAL_FILE_LINES.slice(8, 13).join("\n"));
    });

    it("can get the release notes for a version at the end of a normal file", function() {
      let releaseNotes = new ReleaseNotes(NORMAL_FILE);
      expect(releaseNotes.notesForVersion("1.0.0"))
        .toEqual(NORMAL_FILE_LINES.slice(14, 18).join("\n"));
    });

    it("can get the release notes for a version at the end of a file with no empty lines", function() {
      let releaseNotes = new ReleaseNotes(NO_WHITESPACE);
      expect(releaseNotes.notesForVersion("1.0.0"))
        .toEqual(NO_WHITESPACE_LINES.slice(9, 12).join("\n"));
    });

    it("throws an error if you try to get the release notes for a version which doesn't exist", function() {
      let releaseNotes = new ReleaseNotes(NORMAL_FILE);
      expect(() => releaseNotes.notesForVersion("9.9.9"))
        .toThrow("Could not find notes for version 9.9.9");
    });
  });
});
