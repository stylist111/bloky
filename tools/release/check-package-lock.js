#!/usr/bin/env node

// Usage: check-package-lock.js <package-lock.json>
//
// We have several native dependencies which are brought in by our various
// dependencies and build tools. They tend to have these listed as
// "optionalDependencies", since you're supposed to get the one appropriate to
// your platform. Sometimes, when you update the lockfile, it will incorrectly
// remove the dependencies needed by other platforms from the lockfile.
//
// This script aims to catch when these dependencies are accidentally removed and
// prevent this from being merged into the main branch.
//
// The package-lock.json file can generally be fixed by:
// - Reverting your `package-lock.json` to a previous good state with
//   `git checkout origin/main -- package-lock.json`
// - Running `npm install` to update it based on the changes in your branch.
//
// Relevant NPM bug: https://github.com/npm/cli/issues/4828

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const [, , packageLockPath] = process.argv;

if (!packageLockPath) {
  console.error(`Usage: ${process.argv[1]} <package-lock.json>`);
  process.exit(1);
}

const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
const packages = packageLock.packages ?? {};

function checkExists(name) {
  console.log(`Checking that ${name} exists`);

  if (!Object.keys(packages).includes(`node_modules/${name}`)) {
    console.error(
      `${name} not found in ${packageLockPath}. See tools/release/check-package-lock.js for details.`,
    );
    process.exit(1);
  }
}

function checkOnlyOneVersion(name) {
  console.log(`Checking that there is only one version of ${name}`);

  let explanations;
  try {
    const output = execSync(`npm explain --package-lock-only --json ${name}`, {
      encoding: "utf8",
      cwd: path.dirname(path.resolve(packageLockPath)),
      // The JSON dependency tree for widely-depended-on packages can exceed
      // execSync's default 1 MB stdout buffer, which would throw ENOBUFS.
      maxBuffer: 5 * 1024 * 1024,
    });
    explanations = JSON.parse(output);
  } catch (e) {
    console.error(`Failed to run npm explain for ${name}: ${e.message}`);
    process.exit(1);
  }

  if (explanations.length > 1) {
    console.error(`Multiple versions of ${name} found in ${packageLockPath}`);
    for (const explanation of explanations) {
      console.error(`  ${explanation.location} -> ${explanation.version}`);
    }
    console.error(
      "Only one version is allowed. See tools/release/check-package-lock.js for details.",
    );
    process.exit(1);
  }
}

// These packages are all expected to have an entry in package-lock.json that
// lists where they will be checkout out on the relevant operating system. There
// are typically other platforms too, like Android, or Intel Macs, but checking
// x64 Linux and ARM Darwin (MacOS) for each relevant library should cover all
// cases where things are broken.

// If any of these libraries are removed entirely, then they can be removed them
// from this list too.

// ESBuild and Rollup - Used internally by Vite
checkExists("@esbuild/linux-x64");
checkExists("@esbuild/darwin-arm64");
checkExists("@rollup/rollup-linux-x64-gnu");
checkExists("@rollup/rollup-darwin-arm64");

// Sentry CLI
checkExists("@sentry/cli-linux-x64");
checkExists("@sentry/cli-darwin");

// NX - Lerna's build tool
checkExists("@nx/nx-linux-x64-gnu");
checkExists("@nx/nx-darwin-arm64");

// Sharp
checkExists("@img/sharp-linux-x64");
checkExists("@img/sharp-darwin-arm64");
checkExists("@img/sharp-libvips-linux-x64");
checkExists("@img/sharp-libvips-darwin-arm64");

// Only one version of typescript is allowed because multiple versions cause
// issues because we have a shared typescript config.
checkOnlyOneVersion("typescript");
