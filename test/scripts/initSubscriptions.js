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

import {Buffer} from "node:buffer";
import expect from "expect";
import fs from "fs";
import os from "os";
import path from "path";
import nock from "nock";

import {init, backendUrl as backendUrlMv3}
  from "../../scripts/initSubscriptions.js";

const ENCODING = "utf-8";
const backendUrl = new URL(backendUrlMv3);

describe("initSubscriptions script", function() {
  let tmpDir;
  let outDir;
  let warnings;
  let errors;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  function mockedConsoleErr(message) {
    errors.push(message);
  }

  function createFile(dir, data) {
    let file = path.join(dir, "subscriptions.json");
    fs.writeFileSync(file, data);
    return file;
  }

  beforeEach(async function() {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tmp-"));
    outDir = path.join(tmpDir, "outDir");
    fs.mkdirSync(outDir);
    console.warn = mockedConsoleWarn;
    console.error = mockedConsoleErr;
    warnings = [];
    errors = [];
  });

  afterEach(async function() {
    if (fs.existsSync(tmpDir)) {
      await fs.promises.rm(tmpDir, {recursive: true});
    }
  });

  it("should download MV3 list", async function() {
    const subscriptionsListData = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription",
        "url": "someUrl",
        "homepage": "https://easylist.to/"
      }]`);
    const file = path.join(outDir, "file.tmp");

    nock(backendUrl.origin)
      .get(backendUrl.pathname)
      .reply(200, subscriptionsListData);

    await init(file);
    expect(await fs.promises.readFile(file))
      .toEqual(Buffer.from(subscriptionsListData, ENCODING));
  });

  for (let statusCode of [400, 401, 404, 422]) {
    it(`should handle request ${statusCode} on download`, async function() {
      const file = path.join(outDir, "file.tmp");

      nock(backendUrl.origin)
        .get(backendUrl.pathname)
        .reply(statusCode);

      await expect(init(file)).rejects.toThrow({
        name: "Error",
        message: `Failed to get '${backendUrl}' (${statusCode})`
      });
    });
  }

  it("uses overriden URL if provided", async function() {
    const customBackend = "http://someCustomBackend/index.json";
    const subscriptionsListData = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription",
        "url": "someUrl2",
        "homepage": "https://easylist.to/"
      }]`);
    const file = path.join(outDir, "file.tmp");

    let customBackendUrl = new URL(customBackend);
    nock(customBackendUrl.origin)
      .get(customBackendUrl.pathname)
      .reply(200, subscriptionsListData);

    await init(file, customBackend);
    expect(await fs.promises.readFile(file))
      .toEqual(Buffer.from(subscriptionsListData, ENCODING));
  });
});
