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

/** @module */

"use strict";

/**
 * @file Snippet exceptions implementation.
 */

const {parseScript} = require("./scriptParsing");

class SnippetExceptions {
  /**
   * @hideconstructor
   */
  constructor() {
    /**
     * Lookup table, lists of snippet exceptions by JSON-serialized script
     * command
     * @type {Map.<string, Set.<module:filterClasses.SnippetException>>}
     * @private
     */
    this._exceptionsByCommand = new Map();

    /**
     * Set containing known snippet exceptions
     * @type {Set.<module:filterClasses.SnippetException>}
     * @private
     */
    this._exceptions = new Set();
  }

  /**
   * The number of known snippet exceptions.
   * @type {number}
   */
  get size() {
    return this._exceptions.size;
  }

  /**
   * Removes all known snippet exceptions.
   */
  clear() {
    this._exceptionsByCommand.clear();
    this._exceptions.clear();
  }

  /**
   * Adds a new snippet exception.
   * @param {module:filterClasses.SnippetException} exception
   */
  add(exception) {
    if (this._exceptions.has(exception)) {
      return;
    }

    for (let command of parseScript(exception.script)) {
      let key = JSON.stringify(command);
      let set = this._exceptionsByCommand.get(key);
      if (set) {
        set.add(exception);
      }
      else {
        this._exceptionsByCommand.set(key, new Set([exception]));
      }
    }

    this._exceptions.add(exception);
  }

  /**
   * Removes an existing snippet exception.
   * @param {module:filterClasses.SnippetException} exception
   */
  remove(exception) {
    if (!this._exceptions.has(exception)) {
      return;
    }

    for (let command of parseScript(exception.script)) {
      let key = JSON.stringify(command);
      let set = this._exceptionsByCommand.get(key);
      if (set) {
        set.delete(exception);
        if (set.size == 0) {
          this._exceptionsByCommand.delete(key);
        }
      }
    }

    this._exceptions.delete(exception);
  }

  /**
   * Checks whether a snippet exception exists.
   * @param {module:filterClasses.SnippetException} exception
   * @returns {boolean}
   */
  has(exception) {
    return this._exceptions.has(exception);
  }

  /**
   * Checks whether an exception rule is registered for a script command on a
   * particular domain.
   * @param {string[]} command A single parsed script command, as returned by
   *   `{@link module:scriptParsing.parseScript parseScript()}`.
   * @param {?string} [domain]
   * @returns {?module:filterClasses.SnippetException}
   */
  getException(command, domain) {
    let exceptions = this._exceptionsByCommand.get(JSON.stringify(command));
    if (exceptions) {
      for (let exception of exceptions) {
        if (exception.isActiveOnDomain(domain)) {
          return exception;
        }
      }
    }

    return null;
  }
}

/**
 * Container for snippet exceptions.
 */
exports.SnippetExceptions = SnippetExceptions;
