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

import {IO as ioIdb} from "./io-idb.js";
import {IO as ioBsl} from "./io-bsl.js";

let io;
let initializationPromise;

export function readFileContent(path) {
  const url = browser.runtime.getURL(path);
  return fetch(url).then(content => content.text());
}

// This is a facade implementation that forwards to the current concrete
// implementation of IO. By default IndexedDB is used but if it's unavailable
// a fallback to `browser.storage.local` is used.
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
    return io.readFromFile(filename, listener);
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
    return io.writeToFile(filename, lines);
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
    return io.renameFile(oldName, newName);
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
    return io.statFile(filename);
  },

  /**
   * Initialize the storage
   * @return {Promise} initialization promise
   */
  initialize() {
    if (!initializationPromise) {
      initializationPromise = (async() => {
        io = ioIdb;
        try {
          await io.initialize();
        }
        catch (e) {
          if (e instanceof DOMException &&
              e.name == "InvalidStateError") {
            // fall back to `browser.storage.local` API if IndexedDb
            // is unavailable, eg. in Firefox in private mode. See
            // https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/231
            io = ioBsl;
            try {
              await io.initialize();
            }
            catch {
              initializationPromise = null;
              throw e;
            }
          }
          else {
            initializationPromise = null;
            throw e;
          }
        }
      })();
    }

    return initializationPromise;
  }
};
