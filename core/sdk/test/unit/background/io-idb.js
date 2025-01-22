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

import expect from "expect";

import {openDatabase} from "../../../src/background/idb.js";
import {IO} from "../../../src/background/io-idb.js";
import {IDBFactory} from "fake-indexeddb";

describe("IndexedDB IO", function() {
  let originalIDB;

  before(function() {
    originalIDB = global.indexedDB; // eslint-disable-line no-undef
  });

  after(function() {
    global.indexedDB = originalIDB; // eslint-disable-line no-undef
  });

  beforeEach(async function() {
    global.indexedDB = new IDBFactory(); // eslint-disable-line no-undef
    await IO.initialize();
  });

  it("saves a file", async function() {
    let filename = "test-file.ini";
    let contents = ["hello", "world"];

    await IO.writeToFile(filename, contents);

    let readResult = [];
    let listener = function(line) {
      readResult.push(line);
    };
    await IO.readFromFile(filename, listener);
    expect(readResult).toEqual(contents);
  });

  it("renames a file", async function() {
    let filenameBefore = "test-file-1.ini";
    let filenameAfter = "test-file-2.ini";
    let contents = ["hello", "world"];

    await IO.writeToFile(filenameBefore, contents);

    await IO.renameFile(filenameBefore, filenameAfter);

    await expect(IO.readFromFile(filenameBefore, () => {}))
      .rejects.toThrow(new Error("File does not exist"));

    let readResult = [];
    let listener = function(line) {
      readResult.push(line);
    };
    await IO.readFromFile(filenameAfter, listener);
    expect(readResult).toEqual(contents);
  });

  it("renames a file to itself without causing data issues", async function() {
    let filename = "test-file.ini";
    let contents = ["hello", "world"];

    await IO.writeToFile(filename, contents);
    await IO.renameFile(filename, filename);

    let readResult = [];
    let listener = function(line) {
      readResult.push(line);
    };
    await IO.readFromFile(filename, listener);
    expect(readResult).toEqual(contents);
  });

  it("recovers from data corruption where the file handle is lost", async function() {
    let filename = "test-file.ini";
    let contents = ["hello", "world"];

    await IO.writeToFile(filename, contents);

    let db = await openDatabase();
    await new Promise((resolve, reject) => {
      let tx = db.transaction(["file-entries"], "readwrite");
      let entryStore = tx.objectStore("file-entries");
      entryStore.get(filename).onsuccess = event => {
        let entry = event.target.result;
        entry.content = null;
        entryStore.put(entry, filename);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = event => reject(event.target.error);
    });

    await IO.writeToFile(filename, contents);
  });
});
