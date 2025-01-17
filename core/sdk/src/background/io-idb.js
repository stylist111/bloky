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

import {openDatabase} from "./idb.js";

let database;

function clearContent(filename, entryStore, contentStore) {
  entryStore.get(filename).onsuccess = event => {
    let entry = event.target.result;
    if (entry) {
      contentStore.delete(entry.content);
    }
  };
}

function saveFile(db, filename, lines, lastModified) {
  return new Promise((resolve, reject) => {
    let data = new TextEncoder().encode(Array.from(lines).join("\n"));
    let tx = db.transaction(["file-entries", "file-contents"], "readwrite");
    let entryStore = tx.objectStore("file-entries");
    let contentStore = tx.objectStore("file-contents");

    clearContent(filename, entryStore, contentStore);
    contentStore.add(data).onsuccess = event => {
      let content = event.target.result;
      entryStore.put({lastModified, content}, filename);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = event => reject(event.target.error);
  });
}

async function initIO(db) {
  database = db;
}

export function getDatabase() {
  if (!database) {
    throw new Error("Database hasn't been opened. Did you call start()?");
  }
  return database;
}

// IO implementation that is using `IndexedDB`
export let IO = {
  /**
   * Reads text lines from a file.
   * @param {string} filename
   *    Name of the file to be read
   * @param {TextSink} listener
   *    Function that will be called for each line in the file
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  async readFromFile(filename, listener) {
    let data = await new Promise((resolve, reject) => {
      let db = getDatabase();
      let tx = db.transaction(["file-entries", "file-contents"], "readonly");
      let entryStore = tx.objectStore("file-entries");
      let contentStore = tx.objectStore("file-contents");

      entryStore.get(filename).onsuccess = entryEvent => {
        let entry = entryEvent.target.result;
        if (!entry) {
          reject(new Error("File does not exist"));
          return;
        }

        contentStore.get(entry.content).onsuccess = contentEvent => {
          resolve(contentEvent.target.result);
        };
      };

      tx.onerror = tx.onabort = event => reject(event.target.error);
    });

    let decoder = new TextDecoder();
    let start = 0;

    while (true) {
      let index = data.indexOf(10 /* newline character */, start + 1000);
      let end = index != -1 ? index : data.length;
      let text = decoder.decode(data.subarray(start, end));

      for (let line of text.split("\n")) {
        listener(line);
      }

      if (index == -1) {
        break;
      }

      start = index + 1;
    }
  },

  /**
   * Writes text lines to a file.
   * @param {string} filename
   *    Name of the file to be written
   * @param {Iterable<string>} lines
   *    An array-like or iterable object containing the lines (without line
   *    endings)
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  async writeToFile(filename, lines) {
    await saveFile(getDatabase(), filename, lines, Date.now());
  },

  /**
   * Renames a file.
   * @param {string} oldName
   *    Name of the file to be renamed
   * @param {string} newName
   *    New file name, will be overwritten if exists
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  renameFile(oldName, newName) {
    return new Promise((resolve, reject) => {
      let db = getDatabase();
      let tx = db.transaction(["file-entries", "file-contents"], "readwrite");
      let entryStore = tx.objectStore("file-entries");
      let contentStore = tx.objectStore("file-contents");

      entryStore.get(oldName).onsuccess = event => {
        let entry = event.target.result;
        if (!entry) {
          reject(new Error("File does not exist"));
          return;
        }

        clearContent(newName, entryStore, contentStore);
        entryStore.put(entry, newName);
        entryStore.delete(oldName);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = event => reject(event.target.error);
    });
  },

  /**
   * Retrieves file metadata.
   * @param {string} filename
   *    Name of the file to be looked up
   * @return {Promise<StatData>}
   *    Promise to be resolved with file metadata once the operation is
   *    completed
   */
  statFile(filename) {
    return new Promise((resolve, reject) => {
      let db = getDatabase();
      let tx = db.transaction(["file-entries"], "readonly");
      let store = tx.objectStore("file-entries");

      store.get(filename).onsuccess = event => {
        let entry = event.target.result;
        let exists = false;
        let lastModified;

        if (entry) {
          exists = true;
          lastModified = entry.lastModified;
        }

        resolve({exists, lastModified});
      };

      tx.onerror = tx.onabort = event => reject(event.target.error);
    });
  },

  /**
   * Initialize the storage
   * @return {Promise} initialization promise
   */
  async initialize() {
    let db = await openDatabase();
    await initIO(db);
  }
};
