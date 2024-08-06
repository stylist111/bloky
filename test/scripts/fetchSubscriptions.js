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

import {fetchSubscriptions} from "../../scripts/fetchSubscriptions.js";

const VALID_RULESET_FILE = "03648752-31EE-4FD0-85C1-20B07C5551C3";
const VALID_RULESET_FILE2 = "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F";
const ENCODING = "utf-8";

describe("fetchSubscriptions script", function() {
  let tmpDir;
  let outDir;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  function createFile(dir, data) {
    let file = path.join(dir, "subscriptions.json");
    fs.writeFileSync(file, data);
    return file;
  }

  beforeEach(async function() {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rules-"));
    outDir = path.join(tmpDir, "outDir");
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(async function() {
    if (fs.existsSync(tmpDir)) {
      await fs.promises.rm(tmpDir, {recursive: true});
    }
  });

  it("should throw an error if input file does not exist", async function() {
    let file = path.join(tmpDir, "someNotExistingFile");
    await expect(async() => fetchSubscriptions(file, outDir))
      .rejects.toThrow();
  });

  it("should create output directory if it does not exist", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    expect(fs.existsSync(outDir)).toEqual(false);
    await fetchSubscriptions(subscriptionsFile, outDir);
    expect(fs.existsSync(outDir)).toEqual(true);
  });

  it("should warn on existing output directory", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    fs.mkdirSync(outDir);
    let existingFetchedFile = createFile(outDir, "");
    expect(fs.existsSync(existingFetchedFile)).toEqual(true);
    expect(warnings.length).toEqual(0);
    await fetchSubscriptions(subscriptionsFile, outDir);
    expect(warnings[0]).toEqual("The output directory exists");
  });

  it("should fetch single subscription", async function() {
    const urlPath = "/test_subscription.txt";
    const data = "subscription data";
    const origin = "http://localhost";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(200, data);

    fs.mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = fs.readdirSync(outDir);
    expect(files.length).toEqual(1);
    expect(await fs.promises.readFile(path.join(outDir, files[0])))
      .toEqual(Buffer.from(data, ENCODING));
  });

  it("should fetch multiple subscriptions", async function() {
    const urlPath1 = "/test_subscription1.txt";
    const data1 = "subscription data 1";
    const urlPath2 = "/test_subscription2.txt";
    const data2 = "subscription data 2";
    const origin = "http://localhost";

    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription 1",
        "url": "${origin + urlPath1}",
        "homepage": "https://easylist.to/"
      }, {
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE2}",
        "title": "Test Subscription 2",
        "url": "${origin + urlPath2}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath1).reply(200, data1);
    nock(origin).get(urlPath2).reply(200, data2);

    fs.mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = fs.readdirSync(outDir);
    expect(files.length).toEqual(2);
    expect(await fs.promises.readFile(path.join(outDir, files[0])))
      .toEqual(Buffer.from(data1, ENCODING));
    expect(await fs.promises.readFile(path.join(outDir, files[1])))
      .toEqual(Buffer.from(data2, ENCODING));
  });

  it("should fail on HTTP error", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription.txt";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    fs.mkdirSync(outDir);
    await expect(async() => fetchSubscriptions(subscriptionsFile, outDir))
      .rejects.toThrow();
  });

  it("should fail on file error", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription.txt";
    const data1 = "subscription data 1";
    const url = origin + urlPath;
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription",
        "url": "${url}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(200, data1);

    fs.mkdirSync(outDir);
    fs.mkdirSync(path.join(outDir, VALID_RULESET_FILE));
    await expect(async() => fetchSubscriptions(subscriptionsFile, outDir))
      .rejects.toThrow();
  });

  it("should fail on HTTP error for at least one subscription", async function() {
    const origin = "http://localhost";
    const urlPath1 = "/test_subscription1.txt";
    const urlPath2 = "/test_subscription2.txt";
    const data1 = "subscription data 1";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription 1",
        "url": "${origin + urlPath1}",
        "homepage": "https://easylist.to/"
      }, {
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE2}",
        "title": "Test Subscription 2",
        "url": "${origin + urlPath2}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath1).reply(200, data1); // no HTTP error
    nock(origin).get(urlPath2).reply(404); // simulate HTTP error

    fs.mkdirSync(outDir);
    await expect(async() => fetchSubscriptions(subscriptionsFile, outDir))
      .rejects.toThrow();
  });

  it("should not create an empty file on HTTP download failure", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription1.txt";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription 1",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    fs.mkdirSync(outDir);
    await expect(async() => fetchSubscriptions(subscriptionsFile, outDir))
      .rejects.toThrow();
    let files = fs.readdirSync(outDir);
    expect(files.length).toEqual(0);
  });

  it("should not clean an existing file on HTTP download failure", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription1.txt";
    const url = origin + urlPath;
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription 1",
        "url": "${url}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    fs.mkdirSync(outDir);
    let filename = path.join(outDir, VALID_RULESET_FILE);
    const data = "something";
    fs.writeFileSync(filename, data); // existing file with some data

    await expect(async() => fetchSubscriptions(subscriptionsFile, outDir))
      .rejects.toThrow();
    let files = fs.readdirSync(outDir);
    expect(files.length).toEqual(1);
    expect(await fs.promises.readFile(filename))
      .toEqual(Buffer.from(data, ENCODING));
  });

  it("should fetch multiple subscriptions and ignore errors", async function() {
    const urlPath1 = "/test_subscription1.txt";
    const data1 = "subscription data 1";
    const urlPath2 = "/test_subscription2.txt";
    const origin = "http://localhost";

    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE}",
        "title": "Test Subscription 1",
        "url": "${origin + urlPath1}",
        "homepage": "https://easylist.to/"
      }, {
        "type": "ads",
        "languages": [
          "en"
        ],
        "id": "${VALID_RULESET_FILE2}",
        "title": "Test Subscription 2",
        "url": "${origin + urlPath2}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath1).reply(404);
    nock(origin).get(urlPath2).reply(200, data1);

    fs.mkdirSync(outDir);
    await expect(await fetchSubscriptions(subscriptionsFile, outDir, true))
      .not.toBeDefined();
    let files = fs.readdirSync(outDir);
    expect(files.length).toEqual(2);
    expect(await fs.promises.readFile(`${outDir}/${VALID_RULESET_FILE2}`))
      .toEqual(Buffer.from(data1, ENCODING));
  });
});
