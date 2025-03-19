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

import { select, confirm, input } from '@inquirer/prompts';
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { ReleaseNotes } from "./release-notes.js";
import { updateVersionInConfig } from "./version-bump.js";
import { executeShellCommand, gitRepoHasChanges, checkIfGitRefExists } from "./utils.js";

async function executeMaybe(command, dryRun) {
  if (dryRun) {
    console.log(`🚒 Dry run, would have run: ${command}`);
  } else {
    await executeShellCommand(command);
  }
}

async function run() {
  const validVersionRegex = /^\d+(\.\d+){1,3}$/;

  const args = yargs(hideBin(process.argv))
    .version(false)
    .strict()
    .command("$0 [host] [version] [commit]", "", subparser =>
      subparser.positional("host", { choices: ["adblock", "adblockplus"] })
        .positional("version", { type: "string" })
        .positional("commit", { type: "string" }))
    .option("release-date", {
      type: "string",
      description: "Sets the date of the release. Defaults to today.",
      coerce: arg => new Date(arg)
    })
    .option("yes", {
      type: "boolean",
      description: "Answers yes to all prompts."
    })
    .option("skip-git", {
      type: "boolean",
      description: "Don't actually run any git commands. Useful for manual testing the script interface."
    })
    .option("skip-tag", {
      type: "boolean",
      description: "Do not create a tag for the release."
    })
    .check(argv => {
      if (argv.version && !validVersionRegex.test(argv.version)) {
        throw new Error("Invalid version: Version must be a semver version.");
      }

      if (argv.releaseDate && isNaN(argv.releaseDate)) {
        throw new Error("Invalid release date: This must be a valid date string.");
      }

      if (argv.yes && !(argv.host && argv.version && argv.commit)) {
        throw new Error("The --yes option can only be used if host, version and commit are all specified.");
      }

      return true;
    })
    .parse();

  if (!args.skipGit && await gitRepoHasChanges()) {
    console.log("🔥 You have uncommitted changes. Commit them or stash them and try again.");
    process.exit(1);
  }

  console.log('🤖 Fetching latest changes');
  await executeMaybe('git fetch --all', args.skipGit);

  args.host = args.host || await select({
    message: 'Which host do you want to release?',
    choices: [
      {
        name: 'AdBlock',
        value: 'adblock'
      },
      {
        name: 'Adblock Plus',
        value: 'adblockplus'
      }
    ]
  });

  args.version = args.version || await input({
    message: 'What is the new version number?',
    validate: version => validVersionRegex.test(version) || "Version must be a semver version"
  });

  args.commit = args.commit || await input({
    message: 'What is the git commit to release?',
    validate: async ref => await checkIfGitRefExists(ref) || "That is not a known git reference."
  });

  const tagName = `${args.host}-${args.version}`;

  if (!args.skipGit) {
    const legacyTagName = `${args.host}-v${args.version}`;
    const existingTags = await executeShellCommand(`git tag --list ${tagName} ${legacyTagName}`);
    const versionAlreadyExists = existingTags != "";

    if (versionAlreadyExists) {
      console.log(`🔥 ${args.host} version ${args.version} already exists. Exiting the release process.`);
      process.exit(1);
    }
  }

  const branchName = `${args.host}-release`;
  console.log(`🤖 Creating release branch: ${branchName}`);
  await executeMaybe(`git checkout -B ${branchName} ${args.commit}`, args.skipGit);

  const releaseNotesPath = ReleaseNotes.hostFilePath(args.host);
  let releaseNotes = await ReleaseNotes.readFromHostFilepath(args.host);

  if (!args.yes) {
    let shouldContinue = false;

    while (!shouldContinue) {
      if (releaseNotes.hasUnreleasedNotes()) {
        console.log('\n---------------------------------\n');
        console.log('🤖 No release notes found.');
        console.log(`\n🤖 Add a brief one line summary and edit ${releaseNotesPath} to continue the release`);
        console.log('\n---------------------------------\n');

        const answer = await confirm({
          message: 'Are you ready to reload the release notes?'
        });
        if (answer) {
          console.log('🤖 Reloading release notes file');
          releaseNotes = await ReleaseNotes.readFromHostFilepath(args.host);
        }
        continue;
      }

      console.log('\n---------------------------------\n');
      console.log('🤖 Please proof-read these release notes. They should:');
      console.log('- Have a brief one line summary.');
      console.log('- Mention each user-facing change in the release.');
      console.log('- Not have any spelling or grammatical errors.');
      console.log(`\n🤖 If this is not the case, edit ${releaseNotesPath} and select "Reload"`);
      console.log('\n---------------------------------\n');
      console.log(releaseNotes.unreleasedNotes());
      console.log('\n---------------------------------\n');

      const answer = await select({
        message: 'Is this the version you want to release?',
        choices: [
          {
            name: 'Yes - Continue with the release',
            value: 'yes',
            description: 'Proceed with the release process'
          },
          {
            name: 'No - Exit the release process',
            value: 'no',
            description: 'Cancel the release'
          },
          {
            name: 'Reload - Check release notes again',
            value: 'reload',
            description: `Update ${releaseNotesPath} and reload to check again`
          }
        ]
      });

      if (answer === 'yes') {
        shouldContinue = true;
      } else if (answer === 'reload') {
        console.log('🤖 Reloading release notes file');
        releaseNotes = await ReleaseNotes.readFromHostFilepath(args.host);
      } else if (answer === 'no') {
        console.log('🔥 Exiting the release process.');
        process.exit(1);
      }
    }
  } else if (releaseNotes.hasUnreleasedNotes()) {
    console.log(`🔥 No release notes found. Add a brief one line summary, edit ${releaseNotesPath} and try again.`);
    process.exit(1);
  }

  console.log(`🤖 Updating release notes file: ${releaseNotesPath}`);
  releaseNotes.insertNewVersionHeading(args.version, args.releaseDate || new Date());
  await releaseNotes.writeToHostFilepath(args.host);

  console.log(`🤖 Updating ${args.host}'s version to ${args.version}`);
  await updateVersionInConfig(args.host, args.version);

  if (!args.yes) {
    console.log('---------------------------------\n');
    console.log('🤖 The following changes will be made:\n');
    console.log(`- Push branch '${branchName}' to origin`);

    if (!args.skipTag) {
      console.log(`- Create and push tag '${tagName}' to origin`);
    }

    console.log(`- Update ${args.host} version from current to ${args.version}`);
    console.log('---------------------------------\n');

    const answer = await confirm({
      message: "You are about to release the above changes. Are you sure?",
    });

    if (!answer) {
      console.log('🔥 Exiting the release process.');
      process.exit(1);
    }
  }

  await executeMaybe(`git commit --all -m 'build: Releasing ${args.host} ${args.version} [noissue]'`, args.skipGit);
  await executeMaybe(`git push origin ${branchName} -f`, args.skipGit);
  console.log(`🤖 Changes have been commited and pushed to ${branchName}`);

  if (!args.skipTag) {
    await executeMaybe(`git tag -a -m '' ${tagName}`, args.skipGit);
    await executeMaybe(`git push origin ${tagName}`, args.skipGit);
    console.log(`🤖 Tag ${tagName} has been created and pushed`);
  }

  console.log('🤖 The version bump has completed successfully! The release process continues here:');
  console.log('https://gitlab.com/eyeo/extensions/extensions/-/wikis/Host-release-process#get-builds');
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
