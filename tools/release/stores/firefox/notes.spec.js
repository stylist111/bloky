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

import { describe, expect, it } from "vitest";

import { ReleaseNotes } from "../../release-notes.js";
import {
  REVIEWER_NOTES_HEADING,
  readReviewerNotes,
  releaseNotesBody,
  storeListingSection,
} from "./notes.js";

const RELEASE_NOTES = [
  "# Unreleased",
  "",
  "# 4.46.0 - 2026-10-06",
  "",
  "This release contains bugfixes and under-the-hood changes.",
  "",
  "- Fixed a crash on start",
  "- Updated translations",
  "",
  "# 4.45.0 - 2026-09-29",
  "",
  "- Older change",
].join("\n");

const STORE_LISTING = [
  "# Store listing",
  "",
  "## Single purpose",
  "",
  "```",
  "Blocks ads",
  "```",
  "",
  REVIEWER_NOTES_HEADING,
  "",
  "```md",
  "# Adblock Plus",
  "",
  "## Building the extension",
  "",
  "    npm run build:release",
  "```",
  "",
  "## Opera notes for reviewers",
  "",
  "```md",
  "Opera notes",
  "```",
].join("\n");

describe("releaseNotesBody", () => {
  it("returns the version's summary and changes without the heading", () => {
    expect(releaseNotesBody(new ReleaseNotes(RELEASE_NOTES), "4.46.0")).toBe(
      [
        "This release contains bugfixes and under-the-hood changes.",
        "",
        "- Fixed a crash on start",
        "- Updated translations",
      ].join("\n"),
    );
  });

  it("drops blank lines between changes", () => {
    const releaseNotes = new ReleaseNotes(
      [
        "# 4.47.0 - 2026-10-12",
        "",
        "- Updated snippets to 2.17.0",
        "",
        "- Added the time of the last account login to",
        "  the debug information.",
        "",
        "- Fixed a crash on start",
        "",
        "## Filter changes",
        "",
        "- Updated filter lists",
      ].join("\n"),
    );

    expect(releaseNotesBody(releaseNotes, "4.47.0")).toBe(
      [
        "- Updated snippets to 2.17.0",
        "- Added the time of the last account login to",
        "  the debug information.",
        "- Fixed a crash on start",
        "",
        "## Filter changes",
        "",
        "- Updated filter lists",
      ].join("\n"),
    );
  });

  it("works for versions without a summary", () => {
    expect(releaseNotesBody(new ReleaseNotes(RELEASE_NOTES), "4.45.0")).toBe(
      "- Older change",
    );
  });

  it("fails for versions without notes", () => {
    expect(() =>
      releaseNotesBody(new ReleaseNotes(RELEASE_NOTES), "9.9.9"),
    ).toThrow("Could not find notes for version 9.9.9");
  });
});

describe("storeListingSection", () => {
  it("returns the fenced block including its own headings", () => {
    expect(storeListingSection(STORE_LISTING, REVIEWER_NOTES_HEADING)).toBe(
      [
        "# Adblock Plus",
        "",
        "## Building the extension",
        "",
        "    npm run build:release",
      ].join("\n"),
    );
  });

  it("handles Windows line endings", () => {
    expect(
      storeListingSection(
        STORE_LISTING.replaceAll("\n", "\r\n"),
        "## Opera notes for reviewers",
      ),
    ).toBe("Opera notes");
  });

  it("fails when the heading is missing", () => {
    expect(() =>
      storeListingSection("# Nothing", REVIEWER_NOTES_HEADING),
    ).toThrow(
      'STORE_LISTING.md has no "## Firefox AMO notes for reviewers" section',
    );
  });

  it("fails when the heading isn't followed by a fenced block", () => {
    const markdown = [REVIEWER_NOTES_HEADING, "", "Plain text"].join("\n");

    expect(() => storeListingSection(markdown, REVIEWER_NOTES_HEADING)).toThrow(
      "section of STORE_LISTING.md has no fenced block",
    );
  });
});

describe("readReviewerNotes", () => {
  it("finds the reviewer notes in both hosts' store listings", async () => {
    for (const host of ["adblock", "adblockplus"]) {
      const notes = await readReviewerNotes(host);

      expect(notes.length).toBeGreaterThan(100);
      expect(notes).toContain("npm run build:release");
    }
  });
});
