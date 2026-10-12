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

import {
  createAnnouncement,
  formatReleaseNotes,
  latestVersion,
} from "./announcement.js";
import { ReleaseNotes } from "./release-notes.js";

const RELEASES_URL =
  "https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/releases";

describe("latestVersion", () => {
  it("returns the first version below the unreleased notes", () => {
    const releaseNotes = new ReleaseNotes(
      [
        "# Unreleased",
        "",
        "# 6.49.0 - 2026-10-13",
        "",
        "- Updated filter lists",
        "",
        "# 6.48.0 - 2026-10-06",
      ].join("\n"),
    );

    expect(latestVersion(releaseNotes)).toBe("6.49.0");
  });

  it("fails without a version heading", () => {
    expect(() => latestVersion(new ReleaseNotes("# Unreleased\n"))).toThrow(
      "RELEASE_NOTES.md has no version heading",
    );
  });
});

describe("formatReleaseNotes", () => {
  it("joins wrapped bullets and drops the version heading", () => {
    const notes = [
      "# 6.48.0 - 2026-10-06",
      "",
      "- Fixed an issue where an on-page dialog could stop being shown",
      "  after its first impression.",
      "- Updated snippets to 2.16.0",
    ].join("\n");

    expect(formatReleaseNotes(notes)).toBe(
      "• Fixed an issue where an on-page dialog could stop being shown after its first impression.\n" +
        "• Updated snippets to 2.16.0",
    );
  });

  it("keeps a summary paragraph before the bullets", () => {
    const notes = [
      "# 6.46.1 - 2026-09-22",
      "",
      "This release contains bugfixes and",
      "under-the-hood changes.",
      "",
      "- Fixed: On-page dialogs failed to render on pages using a legacy",
      "  `<frameset>` layout instead of `<body>`.",
    ].join("\n");

    expect(formatReleaseNotes(notes)).toBe(
      "This release contains bugfixes and under-the-hood changes.\n" +
        "• Fixed: On-page dialogs failed to render on pages using a legacy `<frameset>` layout instead of `<body>`.",
    );
  });
});

describe("createAnnouncement", () => {
  it("announces both products with their notes and links", () => {
    const message = createAnnouncement([
      {
        name: "AdBlock",
        version: "6.48.0",
        releaseUrl: `${RELEASES_URL}/adblock-6.48.0`,
        notes: "# 6.48.0 - 2026-10-06\n\n- Updated snippets to 2.16.0",
      },
      {
        name: "Adblock Plus",
        version: "4.46.0",
        releaseUrl: `${RELEASES_URL}/adblockplus-4.46.0`,
        notes: "# 4.46.0 - 2026-10-06\n\n- Added a Crumbs banner experiment",
      },
    ]);

    expect(message).toBe(
      [
        ":rocket: AdBlock 6.48.0 and Adblock Plus 4.46.0 are on their way to the stores! :tada:",
        "",
        `AdBlock release notes: ${RELEASES_URL}/adblock-6.48.0`,
        "• Updated snippets to 2.16.0",
        "",
        `Adblock Plus release notes: ${RELEASES_URL}/adblockplus-4.46.0`,
        "• Added a Crumbs banner experiment",
        "",
        "You can monitor the status here: https://extension-info-monitoring.vercel.app/",
        "Thanks to everyone who made this release happen! :raised_hands:",
      ].join("\n"),
    );
  });
});
