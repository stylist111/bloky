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

// Texts a Firefox Add-ons submission needs from the repository: the
// version's release notes from RELEASE_NOTES.md, and the notes for
// reviewers from STORE_LISTING.md.

import { readFile } from "fs/promises";
import path from "path";

import { ReleaseNotes } from "../../release-notes.js";
import { projectRootPath } from "../../utils.js";

/**
 * Heading of the STORE_LISTING.md section with the notes for AMO reviewers.
 */
export const REVIEWER_NOTES_HEADING = "## Firefox AMO notes for reviewers";

/**
 * Returns a version's release notes without their `# <version>` heading:
 * the summary line, if there is one, and the list of changes.
 *
 * @param {ReleaseNotes} releaseNotes Parsed RELEASE_NOTES.md.
 * @param {string} version Version being released, e.g. `4.46.0`.
 * @returns {string} The notes.
 * @throws {Error} If RELEASE_NOTES.md has no section for the version.
 */
export function releaseNotesBody(releaseNotes, version) {
  const [, ...body] = releaseNotes.notesForVersion(version).split("\n");
  return body.join("\n").trim();
}

/**
 * Reads a version's release notes from the host's RELEASE_NOTES.md.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {string} version Version being released.
 * @returns {Promise<string>} The notes, without the version heading.
 * @throws {Error} If the file can't be read or has no section for the
 *   version.
 */
export async function readReleaseNotes(host, version) {
  const releaseNotes = await ReleaseNotes.readFromHostFilepath(host);
  return releaseNotesBody(releaseNotes, version);
}

/**
 * Returns the content of the fenced block that follows a heading in
 * STORE_LISTING.md. The block may contain headings of its own, so it ends
 * at the closing fence, not at the next heading.
 *
 * @param {string} markdown Content of STORE_LISTING.md.
 * @param {string} heading Exact heading line, e.g. `REVIEWER_NOTES_HEADING`.
 * @returns {string} The block's content, without the fences.
 * @throws {Error} If the heading or its fenced block is missing.
 */
export function storeListingSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);

  if (headingIndex < 0) {
    throw new Error(`STORE_LISTING.md has no "${heading}" section`);
  }

  const openIndex = lines.findIndex(
    (line, index) => index > headingIndex && line.trim() !== "",
  );
  const closeIndex = lines.findIndex(
    (line, index) => index > openIndex && line.trim() === "```",
  );

  if (!lines[openIndex]?.startsWith("```") || closeIndex < 0) {
    throw new Error(
      `The "${heading}" section of STORE_LISTING.md has no fenced block`,
    );
  }

  return lines
    .slice(openIndex + 1, closeIndex)
    .join("\n")
    .trim();
}

/**
 * Reads the notes for AMO reviewers from the host's STORE_LISTING.md.
 *
 * @param {string} host Host ID, e.g. `adblockplus`.
 * @param {string} [rootPath] Repository root. Defaults to this repository.
 * @returns {Promise<string>} The notes.
 * @throws {Error} If the file can't be read or has no such section.
 */
export async function readReviewerNotes(host, rootPath = projectRootPath()) {
  const file = path.join(rootPath, "host", host, "STORE_LISTING.md");
  const markdown = await readFile(file, "utf8");
  return storeListingSection(markdown, REVIEWER_NOTES_HEADING);
}
