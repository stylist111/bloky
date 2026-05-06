#!/usr/bin/env node
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

import { select, confirm, input, checkbox } from "@inquirer/prompts";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { ReleaseNotes } from "./release-notes.js";
import { updateVersionInConfig } from "./version-bump.js";
import {
  executeShellCommand,
  gitRepoHasChanges,
  checkIfGitRefExists,
} from "./utils.js";

async function executeMaybe(command, dryRun) {
  if (dryRun) {
    console.log(`🚒 Dry run, would have run: ${command}`);
  } else {
    await executeShellCommand(command);
  }
}

const validHosts = ["adblock", "adblockplus", "sdk"];
const hostNames = {
  adblock: "AdBlock",
  adblockplus: "Adblock Plus",
  sdk: "SDK",
};

async function run() {
  const validVersionRegex = /^\d+(\.\d+){1,3}$/;

  const args = yargs(hideBin(process.argv))
    .version(false)
    .strict()
    .command("$0 [commit] [packageSpecs..]", "", (subparser) =>
      subparser
        .positional("commit", {
          type: "string",
          description:
            "The commit reference to base the release on. Can be a SHA hash, or any other valid Git reference.",
        })
        .positional("packageSpecs", {
          type: "array",
          description: `The hosts to release, and their new version numbers. Must be in the format host@version, where host is one of ${validHosts} and version is a semver version.`,
          coerce: (arg) =>
            arg.map((a) => {
              const parts = a.split("@");
              if (parts.length !== 2) {
                throw new Error(
                  `Invalid packageSpec ${a}, Must be in the format host@version, where host is one of ${validHosts} and version is a semver version.`,
                );
              }

              const host = parts[0];
              const version = parts[1];

              if (!validHosts.includes(host)) {
                throw new Error(
                  `Invalid host ${host}, Must be one of ${validHosts}`,
                );
              }

              if (!validVersionRegex.test(version)) {
                throw new Error(
                  `Invalid version ${version}: Version must be a semver version.`,
                );
              }

              return { host, version };
            }),
        }),
    )
    .option("release-date", {
      type: "string",
      description: "Sets the date of the release. Defaults to today.",
      coerce: (arg) => {
        const date = new Date(arg);
        if (isNaN(date)) {
          throw new Error(
            "Invalid release date: This must be a valid date string.",
          );
        }
        return date;
      },
    })
    .option("yes", {
      type: "boolean",
      description: "Answers yes to all prompts.",
    })
    .option("skip-git", {
      type: "boolean",
      description:
        "Don't actually run any git commands. Useful for manual testing the script interface.",
    })
    .option("skip-tag", {
      type: "boolean",
      description: "Do not create a tag for the release.",
    })
    .check((argv) => {
      if (
        argv.yes &&
        !(argv.packageSpecs && argv.packageSpecs.length > 0 && argv.commit)
      ) {
        throw new Error(
          "The --yes option can only be used if host, version and commit are all specified.",
        );
      }

      return true;
    })
    .parse();

  if (!args.skipGit && (await gitRepoHasChanges())) {
    console.log(
      "🔥 You have uncommitted changes. Commit them or stash them and try again.",
    );
    process.exit(1);
  }

  console.log("🤖 Fetching latest changes");
  await executeMaybe("git fetch --all", args.skipGit);

  if (!args.packageSpecs || args.packageSpecs.length === 0) {
    const hosts = await checkbox({
      message: "Which host do you want to release?",
      required: true,
      choices: validHosts.map((host) => {
        return {
          name: hostNames[host],
          value: host,
        };
      }),
    });
    args.packageSpecs = hosts.map((host) => {
      return { host };
    });

    for (const spec of args.packageSpecs) {
      spec.version = await input({
        message: `What is the new version number for ${hostNames[spec.host]}?`,
        validate: (version) =>
          validVersionRegex.test(version) || "Version must be a semver version",
      });
    }
  }

  args.commit =
    args.commit ||
    (await input({
      message: "What is the git commit to release?",
      validate: async (ref) =>
        (await checkIfGitRefExists(ref)) ||
        "That is not a known git reference.",
    }));

  const hostArgs = args.packageSpecs.map((spec) => {
    return {
      host: spec.host,
      hostName: hostNames[spec.host],
      version: spec.version,
      tagName: `${spec.host}-${spec.version}`,
      branchName: `${spec.host}-release`,
    };
  });

  for (const hostArg of hostArgs) {
    if (!args.skipGit) {
      const legacyTagName = `${hostArg.host}-v${hostArg.version}`;
      const existingTags = await executeShellCommand(
        `git tag --list ${hostArg.tagName} ${legacyTagName}`,
      );
      const versionAlreadyExists = existingTags !== "";

      if (versionAlreadyExists) {
        console.log(
          `🔥 ${hostArg.hostName} version ${hostArg.version} already exists. Exiting the release process.`,
        );
        process.exit(1);
      }
    }
  }

  const workingBranch = hostArgs[0].branchName;
  console.log(`🤖 Creating release branch: ${workingBranch}`);
  await executeMaybe(
    `git checkout -B ${workingBranch} ${args.commit}`,
    args.skipGit,
  );

  for (const hostArg of hostArgs) {
    const releaseNotesPath = ReleaseNotes.hostFilePath(hostArg.host);
    let releaseNotes = await ReleaseNotes.readFromHostFilepath(hostArg.host);

    if (!args.yes) {
      let shouldContinue = false;

      while (!shouldContinue) {
        if (releaseNotes.hasUnreleasedNotes()) {
          console.log("\n---------------------------------\n");
          console.log(`🤖 No release notes found for ${hostArg.hostName}.`);
          console.log(
            `\n🤖 Add a brief one line summary and edit ${releaseNotesPath} to continue the release`,
          );
          console.log("\n---------------------------------\n");

          const answer = await confirm({
            message: "Are you ready to reload the release notes?",
          });
          if (answer) {
            console.log("🤖 Reloading release notes file");
            releaseNotes = await ReleaseNotes.readFromHostFilepath(
              hostArg.host,
            );
          }
          continue;
        }

        console.log("\n---------------------------------\n");
        console.log("🤖 Please proof-read these release notes. They should:");
        console.log("- Have a brief one line summary.");
        console.log("- Mention each user-facing change in the release.");
        console.log("- Not have any spelling or grammatical errors.");
        console.log(
          `\n🤖 If this is not the case, edit ${releaseNotesPath} and select "Reload"`,
        );
        console.log("\n---------------------------------\n");
        console.log(`Release Notes for ${hostArg.hostName}:\n`);
        console.log(releaseNotes.unreleasedNotes());
        console.log("\n---------------------------------\n");

        const answer = await select({
          message: "Is this the version you want to release?",
          choices: [
            {
              name: "Yes - Continue with the release",
              value: "yes",
              description: "Proceed with the release process",
            },
            {
              name: "No - Exit the release process",
              value: "no",
              description: "Cancel the release",
            },
            {
              name: "Reload - Check release notes again",
              value: "reload",
              description: `Update ${releaseNotesPath} and reload to check again`,
            },
          ],
        });

        if (answer === "yes") {
          shouldContinue = true;
        } else if (answer === "reload") {
          console.log("🤖 Reloading release notes file");
          releaseNotes = await ReleaseNotes.readFromHostFilepath(hostArg.host);
        } else if (answer === "no") {
          console.log("🔥 Exiting the release process.");
          process.exit(1);
        }
      }
    } else if (releaseNotes.hasUnreleasedNotes()) {
      console.log(
        `🔥 No release notes found. Add a brief one line summary, edit ${releaseNotesPath} and try again.`,
      );
      process.exit(1);
    }

    console.log(`🤖 Updating release notes file: ${releaseNotesPath}`);
    releaseNotes.insertNewVersionHeading(
      hostArg.version,
      args.releaseDate || new Date(),
    );
    await releaseNotes.writeToHostFilepath(hostArg.host);

    console.log(`🤖 Updating ${hostArg.host}'s version to ${hostArg.version}`);
    await updateVersionInConfig(hostArg.host, hostArg.version);
  }

  if (!args.yes) {
    console.log("---------------------------------\n");
    console.log("🤖 The following changes will be made:\n");

    for (const hostArg of hostArgs) {
      console.log(`- Push branch '${hostArg.branchName}' to origin`);

      if (!args.skipTag) {
        console.log(`- Create and push tag '${hostArg.tagName}' to origin`);
      }

      console.log(
        `- Update ${hostArg.host} version from current to ${hostArg.version}`,
      );
    }
    console.log("---------------------------------\n");

    const answer = await confirm({
      message: "You are about to release the above changes. Are you sure?",
    });

    if (!answer) {
      console.log("🔥 Exiting the release process.");
      process.exit(1);
    }
  }

  let commitMessage = "build: Releasing ";
  commitMessage += hostArgs
    .map((hostArg) => `${hostArg.hostName} ${hostArg.version} `)
    .join("and ");
  await executeMaybe(`git commit --all -m '${commitMessage}'`, args.skipGit);

  // We want all relevant release branches to point at the commit that we've
  // just created. We created the commit on our 'working branch', which is the
  // branch for the first host, so the first host's branch is already
  // correct. All the others now need to be created and reset to point at that
  // same commit.
  for (const hostArg of hostArgs.slice(1)) {
    await executeMaybe(
      `git checkout -B ${hostArg.branchName} ${workingBranch}`,
      args.skipGit,
    );
  }

  for (const hostArg of hostArgs) {
    await executeMaybe(
      `git push origin ${hostArg.branchName} -f`,
      args.skipGit,
    );
    console.log(
      `🤖 Changes have been commited and pushed to ${hostArg.branchName}`,
    );

    if (!args.skipTag) {
      await executeMaybe(`git tag -a -m '' ${hostArg.tagName}`, args.skipGit);
      await executeMaybe(`git push origin ${hostArg.tagName}`, args.skipGit);
      console.log(`🤖 Tag ${hostArg.tagName} has been created and pushed`);
    }
  }

  console.log(
    "🤖 The version bump has completed successfully! You may continue with the release process",
  );
  console.log(
    "https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/Host-release-process",
  );
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
