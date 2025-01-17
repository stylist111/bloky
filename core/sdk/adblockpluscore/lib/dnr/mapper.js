/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/** @module */

/**
 * DNR Mapper. Will lazy load the data as needed.
 */
exports.DnrMapper = class DnrMapper {
  /**
   * @param {Function} loader The loader for the mapping data. The
   *     loader function will return the JSON parse output of the map
   *     files. In a Web Extension it will likely use `fetch` to load
   *     it from the extension files. The loader will be called when
   *     the map needs to be used the first time. The function can be
   *     async.
   *
   * @constructor
   */
  constructor(loader) {
    this.loader = loader;
    // A null map is a map that needs to be loaded.
    this.map = null;
  }

  /**
   * Call the loader.
   * @private
   */
  async _loadMapper() {
    this.map = new Map(await this.loader());
  }

  /**
   * Load the map. Because it is async it can't be done on a get.
   * Ideally you'd delay calling it to when neeeded. It is safe to
   * call more than once.
   * @async
   */
  async load() {
    if (this.map === null) {
      await this._loadMapper();
    }
  }

  /**
   * Get the rule ids for the text. Make sure `load()` has been called
   * once previously.
   *
   * @param {string} text The filter text to get the mapping from.
   *
   * @returns {?Array.<number>} The array of rule IDs if found.
   */
  get(text) {
    if (this.map === null) {
      throw new Error("Mapper not loaded.");
    }

    return this.map.get(text);
  }
};
