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

// Prints a message announcing a release of both extensions, to be copied
// from the CI job log into the #releases Slack channel. Meant to run on
// `main` once the release merge request has been merged and tagged.
//
// Usage: node tools/release/announcement.js
//
// Environment: CI_PROJECT_URL, which GitLab CI sets.

import url from "url";

import { ReleaseNotes } from "./release-notes.js";
import { requireOptions } from "./stores/lib/options.js";

const PRODUCTS = Object.freeze([
  { host: "adblock", name: "AdBlock" },
  { host: "adblockplus", name: "Adblock Plus" },
]);

const MONITORING_URL = "https://extension-info-monitoring.vercel.app/";

/**
 * Returns the newest released version in a host's RELEASE_NOTES.md, which is
 * the first version heading below `# Unreleased`.
 *
 * @param {ReleaseNotes} releaseNotes The host's release notes.
 * @returns {string} The version, e.g. `4.46.0`.
 * @throws {Error} If there is no version heading.
 */
export function latestVersion(releaseNotes) {
  const heading = releaseNotes
    .toString()
    .split("\n")
    .find((line) => /^# \d/.test(line));
  if (!heading) {
    throw new Error("RELEASE_NOTES.md has no version heading");
  }

  return heading.slice(2).split(" ")[0];
}

/**
 * Turns a version's section of RELEASE_NOTES.md into text for Slack: drops
 * the version heading, joins hard-wrapped lines and uses Slack's bullet.
 *
 * @param {string} notes The version's section, as returned by
 *   `ReleaseNotes.notesForVersion()`.
 * @returns {string} One line per paragraph or bullet.
 */
export function formatReleaseNotes(notes) {
  const lines = [];
  let continuesLastLine = false;

  for (const line of notes.split("\n").slice(1)) {
    const text = line.trim();

    if (text === "") {
      continuesLastLine = false;
    } else if (text.startsWith("- ")) {
      lines.push(`• ${text.slice(2)}`);
      continuesLastLine = true;
    } else if (continuesLastLine) {
      lines[lines.length - 1] += ` ${text}`;
    } else {
      lines.push(text);
      continuesLastLine = true;
    }
  }

  return lines.join("\n");
}

/**
 * @typedef {object} Release
 * @property {string} name Product name, e.g. `Adblock Plus`.
 * @property {string} version Released version, e.g. `4.46.0`.
 * @property {string} releaseUrl Link to the GitLab release.
 * @property {string} notes The version's section of RELEASE_NOTES.md.
 */

/**
 * Creates the #releases message for a release of both extensions.
 *
 * @param {Release[]} releases One release per product.
 * @returns {string} The message, ready to paste into Slack.
 */
export function createAnnouncement(releases) {
  const titles = releases.map(({ name, version }) => `${name} ${version}`);

  return [
    `:rocket: ${titles.join(" and ")} are on their way to the stores! :tada:`,
    ...releases.flatMap(({ name, releaseUrl, notes }) => [
      "",
      `${name} release notes: ${releaseUrl}`,
      formatReleaseNotes(notes),
    ]),
    "",
    `You can monitor the status here: ${MONITORING_URL}`,
    "Thanks to everyone who made this release happen! :raised_hands:",
  ].join("\n");
}

async function run() {
  requireOptions(
    process.env,
    ["CI_PROJECT_URL"],
    "announcement.js environment",
  );

  const releases = await Promise.all(
    PRODUCTS.map(async ({ host, name }) => {
      const releaseNotes = await ReleaseNotes.readFromHostFilepath(host);
      const version = latestVersion(releaseNotes);

      return {
        name,
        version,
        releaseUrl: `${process.env.CI_PROJECT_URL}/-/releases/${host}-${version}`,
        notes: releaseNotes.notesForVersion(version),
      };
    }),
  );
  const divider = "-".repeat(72);

  console.log(`Copy this message into #releases:\n${divider}`); // allow-console
  console.log(createAnnouncement(releases)); // allow-console
  console.log(divider); // allow-console
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
