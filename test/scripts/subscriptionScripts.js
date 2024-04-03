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

/* eslint-env node */

import expect from "expect";
import fs from "fs";
import {promisify} from "util";
import {exec} from "child_process";
import os from "os";
import path from "path";
import {runTestServer, killTestServer} from "../../scripts/test-server-manager.js";
import {TEST_PAGES_URL} from "../test-server-urls.js";

let originalPath = process.cwd();
let dirPath = path.join(os.tmpdir(), "subscriptionScripts-");

async function execute(cmd, verbose) {
  if (verbose) {
    console.warn("\tExecuting:", cmd);
  }
  await promisify(exec)(cmd);
}

describe("npm module", function() {
  before(async function() {
    await runTestServer();
  });

  after(async function() {
    await killTestServer();
  });

  it("exposes scripts to be available on command line", async function() {
    this.timeout(20000);

    let tmpOutDir = await fs.promises.mkdtemp(dirPath);
    process.chdir(tmpOutDir);
    let scriptsOutputDir = path.join(tmpOutDir, "scriptsOutput");

    await fs.promises.mkdir(scriptsOutputDir);
    await execute(`npm install ${originalPath} --install-links`);

    // scripts toolchain
    for (let cmd of [
      // override URL to reduce network usage and flakiness
      `npx subs-init -u ${TEST_PAGES_URL}/index.json`,
      "npx subs-merge",
      "npx subs-fetch",
      "npx subs-convert",
      "npx subs-generate"
    ]) {
      await execute(cmd);
    }

    let fragmentPath = path.join(scriptsOutputDir, "rulesets/rulesets.json");
    expect(fs.existsSync(fragmentPath)).toEqual(true);
    let fragmentContent = JSON.parse(await fs.promises.readFile(fragmentPath));
    expect(fragmentContent.rule_resources).toEqual(
      expect.arrayContaining([expect.objectContaining({
        id: "03648752-31EE-4FD0-85C1-20B07C5551C3",
        enabled: expect.any(Boolean),
        path: expect.any(String)
      })]));
  });
});
