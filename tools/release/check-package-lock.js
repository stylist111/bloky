#!/usr/bin/env node

// Usage: check-package-lock.js <package-lock.json>
//
// This script performs three categories of sanity checks on package-lock.json
// and is run by the `check_package_lock` GitLab CI job.
//
// 1. Optional platform-specific entries exist (`checkExists`)
//
//    We have several native dependencies which are brought in by our various
//    dependencies and build tools. They tend to have these listed as
//    "optionalDependencies", since you're supposed to get the one appropriate
//    to your platform. Sometimes, when you update the lockfile, it will
//    incorrectly remove the dependencies needed by other platforms from the
//    lockfile.
//
//    This script aims to catch when these dependencies are accidentally
//    removed and prevent this from being merged into the main branch.
//
//    Relevant NPM bug: https://github.com/npm/cli/issues/4828
//
// 2. Only one version of pinned packages (`checkOnlyOneVersion`)
//
//    For some packages (e.g. typescript) only a single version is allowed
//    because multiple resolutions break our shared configuration.
//
// 3. Lockfile is in sync with package.json (`checkNoLockfileDrift`)
//
//    Runs `npm install --package-lock-only` and fails if package-lock.json
//    would have been rewritten. This catches the case where an MR bumps a
//    package.json without regenerating package-lock.json. The lockfile on
//    disk is snapshotted before the install and restored afterwards in every
//    exit path, so this check is safe to run locally and does not leave the
//    working tree mutated.
//
// The package-lock.json file can generally be fixed by:
// - Reverting your `package-lock.json` to a previous good state with
//   `git checkout origin/main -- package-lock.json`
// - Running `npm install` to update it based on the changes in your branch.

import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync } from "child_process";

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
    const { status, stderr, stdout } = spawnSync(
      "npm",
      ["explain", "--package-lock-only", "--json", name],
      {
        encoding: "utf8",
        cwd: path.dirname(path.resolve(packageLockPath)),
        // The JSON dependency tree for widely-depended-on packages can exceed
        // execSync's default 1 MB stdout buffer, which would throw ENOBUFS.
        maxBuffer: 5 * 1024 * 1024,
      },
    );
    if (status !== 0) {
      throw new Error(stderr);
    }

    explanations = JSON.parse(stdout);
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

function cleanupTmp(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Error caught while cleaning up ${tmpDir}: ${err}`);
  }
}

function checkNoLockfileDrift() {
  console.log(
    `Checking that ${packageLockPath} is in sync with package.json (no drift)`,
  );

  const resolvedLockPath = path.resolve(packageLockPath);
  const projectDir = path.dirname(resolvedLockPath);
  const originalContents = fs.readFileSync(resolvedLockPath);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "check-package-lock-"));
  const beforePath = path.join(tmpDir, "package-lock.before.json");
  const afterPath = path.join(tmpDir, "package-lock.after.json");
  fs.writeFileSync(beforePath, originalContents);

  let drifted = false;
  try {
    // `--package-lock-only` rewrites package-lock.json without touching
    // node_modules and without running lifecycle scripts. `--prefer-offline`
    // matches the flags used by the `.base` CI job so we hit the populated
    // `.npm` cache instead of the registry when possible.
    execSync("npm install --package-lock-only --prefer-offline", {
      cwd: projectDir,
      stdio: ["ignore", "inherit", "inherit"],
      // Mirror the buffer bump from checkOnlyOneVersion in case npm prints a
      // lot of warnings.
      maxBuffer: 5 * 1024 * 1024,
    });

    const regenerated = fs.readFileSync(resolvedLockPath);
    drifted = !originalContents.equals(regenerated);

    if (drifted) {
      fs.writeFileSync(afterPath, regenerated);
    }
  } finally {
    // Always restore the original lockfile, whether npm succeeded, failed, or
    // produced a diff. This keeps the working tree byte-identical to what it
    // was before this check ran — important for local devs and for any
    // downstream CI step that reads the file.
    fs.writeFileSync(resolvedLockPath, originalContents);
  }

  if (drifted) {
    console.error(
      `\n${packageLockPath} is out of sync with the project's package.json files.`,
    );
    console.error(
      "Running `npm install --package-lock-only` produced the following diff:\n",
    );

    // `diff -u` exits 1 when files differ and 2 on trouble. We expect 1 here.
    const diffResult = spawnSync("diff", ["-u", beforePath, afterPath], {
      stdio: ["ignore", "inherit", "inherit"],
      maxBuffer: 50 * 1024 * 1024,
    });

    if (diffResult.status !== 0 && diffResult.status !== 1) {
      console.error(
        `\nFailed to produce a unified diff (exit code ${diffResult.status}). ` +
          "The regenerated lockfile differs from the committed one regardless.",
      );
    }

    console.error(
      "\nTo fix: run `npm install` locally, commit the regenerated " +
        "package-lock.json, and push. See tools/release/check-package-lock.js " +
        "for details.",
    );

    // Best-effort cleanup of the temp dir before exiting.
    cleanupTmp(tmpDir);

    process.exit(1);
  }

  cleanupTmp(tmpDir);
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

// Catches the "MR bumps package.json without regenerating package-lock.json"
// case that previously had to be fixed by hand (e.g. MR !1418).
checkNoLockfileDrift();
