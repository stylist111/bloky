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

import browser from "./browser.js";

const KEY_PREFIX = "ewe:file:";

function fileToKey(fileName) {
  return KEY_PREFIX + fileName;
}

async function loadFile(fileName) {
  let key = fileToKey(fileName);
  let items = await browser.storage.local.get(key);
  let entry = items[key];
  if (entry) {
    return entry;
  }
  throw {type: "NoSuchFile"};
}

function saveFile(fileName, data) {
  return browser.storage.local.set({
    [fileToKey(fileName)]: {
      content: Array.from(data),
      lastModified: Date.now()
    }
  });
}

// IO implementation that is using `browser.storage.local` API
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
    let entry = await loadFile(filename);
    for (let line of entry.content) {
      listener(line);
    }
  },

  /**
   * Writes text lines to a file.
   * @param {string} filename
   *    Name of the file to be written
   * @param {Iterable.<string>} data
   *    An array-like or iterable object containing the lines (without line
   *    endings)
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  writeToFile(filename, data) {
    return saveFile(filename, data);
  },

  /**
   * Renames a file.
   * @param {string} fromFile
   *    Name of the file to be renamed
   * @param {string} newName
   *    New file name, will be overwritten if exists
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  async renameFile(fromFile, newName) {
    let entry = await loadFile(fromFile);
    await browser.storage.local.set({[fileToKey(newName)]: entry});
    await browser.storage.local.remove(fileToKey(fromFile));
  },

  /**
   * Retrieves file metadata.
   * @param {string} filename
   *    Name of the file to be looked up
   * @return {Promise.<StatData>}
   *    Promise to be resolved with file metadata once the operation is
   *    completed
   */
  async statFile(filename) {
    try {
      let entry = await loadFile(filename);
      return {
        exists: true,
        lastModified: entry.lastModified
      };
    }
    catch (error) {
      if (error.type == "NoSuchFile") {
        return Promise.resolve({exists: false});
      }
      throw error;
    }
  },

  async fixPrefixes() {
    let data = await browser.storage.local.get();
    for (let key in data) {
      let value = data[key];

      // The order of prefixes matters:
      // the most important should be the last
      // to override the existing values jic.
      for (let eachPrefix of ["abp:file:", "file:"]) {
        if (key.startsWith(eachPrefix)) {
          let obj = {};
          obj[KEY_PREFIX + key.substring(eachPrefix.length)] = value;
          await browser.storage.local.set(obj);
          await browser.storage.local.remove(key);
        }
      }
    }
  },

  /**
   * Initialize the storage
   * @return {Promise} initialization promise
   */
  async initialize() {
    // Migrating the files with 'file:' and `abp:file:` prefixes
    // to 'ewe:file:' stored in `browser.storage.local` in Firefox private mode.
    // See https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/369
    await this.fixPrefixes();
  }
};

