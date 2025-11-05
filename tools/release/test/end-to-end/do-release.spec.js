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

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ignore from "ignore";

import {
  executeShellCommand,
  getCurrentFileDir,
  projectRootPath,
  gitRepoHasChanges,
} from "../../utils.js";

async function loadGitignore() {
  const gitignorePath = path.join(projectRootPath(), ".gitignore");
  const gitignoreContent = await fs.readFile(gitignorePath, "utf8");

  const ig = ignore();
  ig.add(gitignoreContent);
  return ig;
}

async function recursiveCopyDirectoryWithGitignore(
  src,
  dest,
  ig,
  rootDir = src,
) {
  await fs.mkdir(dest, { recursive: true });

  const items = await fs.readdir(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const relativePath = path.relative(rootDir, srcPath);

    if (!ig.ignores(relativePath)) {
      const stats = await fs.stat(srcPath);
      if (stats.isDirectory()) {
        await recursiveCopyDirectoryWithGitignore(
          srcPath,
          destPath,
          ig,
          rootDir,
        );
      } else if (stats.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

async function findNodeModules(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodeModulesDirs = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        nodeModulesDirs.push(fullPath);
      } else {
        nodeModulesDirs.push(...(await findNodeModules(fullPath)));
      }
    }
  }

  return nodeModulesDirs;
}

async function recursiveSymlinkNodeModules(src, dest) {
  const nodeModulesDirs = await findNodeModules(src);
  for (const dir of nodeModulesDirs) {
    const relativePath = path.relative(src, dir);
    const targetPath = path.join(dest, relativePath);
    await fs.symlink(dir, targetPath);
  }
}

async function loadTestFile(relativePath) {
  return await fs.readFile(
    path.join(getCurrentFileDir(import.meta.url), relativePath),
    "utf8",
  );
}

async function configureTestGitUser(repoDir) {
  // This is needed for environments that don't have git identify set up, like
  // CI. Note that it does NOT change global git config, only local to the
  // checkout.

  await executeShellCommand("git config user.name end-to-end-test", repoDir);
  await executeShellCommand(
    "git config user.email end-to-end-test@example.com",
    repoDir,
  );
}

describe("Do-release script", function () {
  let tempDir;
  let originDir;
  let checkoutDir;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "do-release-spec-"));
    originDir = path.join(tempDir, "origin");
    checkoutDir = path.join(tempDir, "checkout");

    const repoRoot = projectRootPath();

    await recursiveCopyDirectoryWithGitignore(
      repoRoot,
      originDir,
      await loadGitignore(),
    );

    if (await gitRepoHasChanges(originDir)) {
      // This commit is so that any uncommitted changes to the do-release script
      // are included in the checkout, and so are used in the test run.
      await configureTestGitUser(originDir);
      await executeShellCommand("git add --all", originDir);
      await executeShellCommand("git commit -m WIP", originDir);
    }

    await executeShellCommand("git clone origin checkout", tempDir);
    await recursiveSymlinkNodeModules(repoRoot, checkoutDir);

    await configureTestGitUser(checkoutDir);
  });

  afterEach(async function () {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("recreates the 4.9 release for adblockplus", async function () {
    await executeShellCommand(
      "npm run do-release -- --yes --release-date=2024-10-31 01debaf19 adblockplus@994.9",
      checkoutDir,
    );

    const diff = await executeShellCommand(
      "git diff --full-index --unified=0 HEAD^..HEAD",
      checkoutDir,
    );
    const expectedDiff = await loadTestFile("adblockplus-994.9-diff.txt");
    expect(diff).toEqual(expectedDiff);

    const newCommit = await executeShellCommand(
      "git rev-parse --short HEAD",
      checkoutDir,
    );
    const checkoutReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      checkoutDir,
    );
    const originReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      originDir,
    );
    const originTagCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-994.9^{commit}",
      originDir,
    );

    expect(checkoutReleaseBranchCommit).toEqual(newCommit);
    expect(originReleaseBranchCommit).toEqual(newCommit);
    expect(originTagCommit).toEqual(newCommit);
  });

  it("recreates the 6.11.0 release for adblock", async function () {
    await executeShellCommand(
      "npm run do-release -- --yes --release-date=2024-10-30 05a2e33a5 adblock@996.11.0",
      checkoutDir,
    );

    const diff = await executeShellCommand(
      "git diff --full-index --unified=0 HEAD^..HEAD",
      checkoutDir,
    );
    const expectedDiff = await loadTestFile("adblock-996.11.0-diff.txt");
    expect(diff).toEqual(expectedDiff);

    const newCommit = await executeShellCommand(
      "git rev-parse --short HEAD",
      checkoutDir,
    );
    const checkoutReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblock-release",
      checkoutDir,
    );
    const originReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblock-release",
      originDir,
    );
    const originTagCommit = await executeShellCommand(
      "git rev-parse --short adblock-996.11.0^{commit}",
      originDir,
    );

    expect(checkoutReleaseBranchCommit).toEqual(newCommit);
    expect(originReleaseBranchCommit).toEqual(newCommit);
    expect(originTagCommit).toEqual(newCommit);
  });

  it(
    "recreates the 2.1.0 release for the sdk",
    { timeout: 20000 },
    async function () {
      await executeShellCommand(
        "npm run do-release -- --yes --release-date=2025-07-31 aff562463 sdk@99.2.1",
        checkoutDir,
      );

      const diff = await executeShellCommand(
        "git diff --full-index --unified=0 HEAD^..HEAD",
        checkoutDir,
      );
      const expectedDiff = await loadTestFile("sdk-99.2.1-diff.txt");
      expect(diff).toEqual(expectedDiff);

      const newCommit = await executeShellCommand(
        "git rev-parse --short HEAD",
        checkoutDir,
      );
      const checkoutReleaseBranchCommit = await executeShellCommand(
        "git rev-parse --short sdk-release",
        checkoutDir,
      );
      const originReleaseBranchCommit = await executeShellCommand(
        "git rev-parse --short sdk-release",
        originDir,
      );
      const originTagCommit = await executeShellCommand(
        "git rev-parse --short sdk-99.2.1^{commit}",
        originDir,
      );

      expect(checkoutReleaseBranchCommit).toEqual(newCommit);
      expect(originReleaseBranchCommit).toEqual(newCommit);
      expect(originTagCommit).toEqual(newCommit);
    },
  );

  it("recreates the 4.10.0.1 release for adblockplus", async function () {
    const scriptHash = await executeShellCommand(
      "git rev-parse HEAD",
      checkoutDir,
    );

    await executeShellCommand("git checkout 4427af61a", checkoutDir);
    await executeShellCommand(
      "sed -i 's/# Unreleased/# Unreleased\\n\\nThis release contains only rules updates for Manifest v3 extensions./g' ./host/adblockplus/RELEASE_NOTES.md",
      checkoutDir,
    );
    await executeShellCommand(
      "git add ./host/adblockplus/RELEASE_NOTES.md",
      checkoutDir,
    );
    await executeShellCommand(
      "git commit -m 'Updated release notes'",
      checkoutDir,
    );
    const toReleaseHash = await executeShellCommand(
      "git rev-parse HEAD",
      checkoutDir,
    );

    await executeShellCommand(`git checkout ${scriptHash}`, checkoutDir);

    await executeShellCommand(
      `npm run do-release -- --yes --release-date=2024-12-16 ${toReleaseHash} adblockplus@994.10.0.1`,
      checkoutDir,
    );

    const diff = await executeShellCommand(
      "git diff --full-index --unified=0 HEAD^..HEAD",
      checkoutDir,
    );
    const expectedDiff = await loadTestFile("adblockplus-994.10.0.1-diff.txt");
    expect(diff).toEqual(expectedDiff);

    const newCommit = await executeShellCommand(
      "git rev-parse --short HEAD",
      checkoutDir,
    );
    const checkoutReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      checkoutDir,
    );
    const originReleaseBranchCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      originDir,
    );
    const originTagCommit = await executeShellCommand(
      "git rev-parse --short adblockplus-994.10.0.1^{commit}",
      originDir,
    );

    expect(checkoutReleaseBranchCommit).toEqual(newCommit);
    expect(originReleaseBranchCommit).toEqual(newCommit);
    expect(originTagCommit).toEqual(newCommit);
  });

  it("releases both hosts at the same time", async function () {
    await executeShellCommand(
      "npm run do-release -- --yes --release-date=2025-10-28 f51ac0968 adblock@996.31.0 adblockplus@994.30.0",
      checkoutDir,
    );

    const diff = await executeShellCommand(
      "git diff --full-index --unified=0 HEAD^..HEAD",
      checkoutDir,
    );
    const expectedDiff = await loadTestFile(
      "adblock-996.31-and-adblockplus-994.30.txt",
    );
    expect(diff).toEqual(expectedDiff);

    const newCommit = await executeShellCommand(
      "git rev-parse --short HEAD",
      checkoutDir,
    );
    const checkoutReleaseBranchCommitAdblock = await executeShellCommand(
      "git rev-parse --short adblock-release",
      checkoutDir,
    );
    const originReleaseBranchCommitAdblock = await executeShellCommand(
      "git rev-parse --short adblock-release",
      originDir,
    );
    const originTagCommitAdblock = await executeShellCommand(
      "git rev-parse --short adblock-996.31.0^{commit}",
      originDir,
    );
    const checkoutReleaseBranchCommitAdblockPlus = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      checkoutDir,
    );
    const originReleaseBranchCommitAdblockPlus = await executeShellCommand(
      "git rev-parse --short adblockplus-release",
      originDir,
    );
    const originTagCommitAdblockPlus = await executeShellCommand(
      "git rev-parse --short adblockplus-994.30.0^{commit}",
      originDir,
    );

    expect(checkoutReleaseBranchCommitAdblock).toEqual(newCommit);
    expect(originReleaseBranchCommitAdblock).toEqual(newCommit);
    expect(originTagCommitAdblock).toEqual(newCommit);
    expect(checkoutReleaseBranchCommitAdblockPlus).toEqual(newCommit);
    expect(originReleaseBranchCommitAdblockPlus).toEqual(newCommit);
    expect(originTagCommitAdblockPlus).toEqual(newCommit);
  });

  it("exits if a version already exists", async function () {
    await expect(() =>
      executeShellCommand(
        "npm run do-release -- --yes HEAD adblock@6.10.0",
        checkoutDir,
      ),
    ).rejects.toThrowError("already exists");
  });

  it("exits if no release notes exist", async function () {
    // Attempt to recreate 4.10.0.1 but without adding release notes
    await expect(() =>
      executeShellCommand(
        `npm run do-release -- --yes --release-date=2024-12-16 4427af61a adblockplus@994.10.0.1`,
        checkoutDir,
      ),
    ).rejects.toThrowError("No release notes found");
  });
});
