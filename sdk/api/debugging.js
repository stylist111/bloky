/* eslint-disable no-console */
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

import {FilterStorage} from "adblockpluscore/lib/filterStorage.js";

import {IO} from "./io.js";
import {addonBundledSubscriptions, addonBundledSubscriptionsPath,
        addonName, addonVersion, manifestVersion} from "./info.js";
import {filterEngine} from "./core.js";
import {awaitSavingComplete} from "./prefs.js";
import {validate} from "./subscriptions.js";

let defaultDebugOptions = {
  elemHide: false,
  cssProperties: [["background", "#e67370"], ["outline", "solid red"]],
  snippetsCssProperties: [
    ["background", "repeating-linear-gradient(to bottom, #e67370 0," +
     "#e67370 9px, white 9px, white 10px)"],
    ["outline", "solid red"]]
};

let listeners = [];

class DebugEventDispatcher {
  addListener(listener) {
    listeners.push(listener);
  }

  removeListener(listener) {
    let index = listeners.findIndex(existingListener =>
      existingListener == listener
    );

    if (index != -1) {
      listeners.splice(index, 1);
    }
  }
}

export const LOG_LEVEL_INFO = 0;
export const LOG_LEVEL_WARNING = 1;
export const LOG_LEVEL_ERROR = 2;

export const LOG_COLOR_RED = "\x1b[31m";
export const LOG_COLOR_GREEN = "\x1b[32m";
export const LOG_COLOR_YELLOW = "\x1b[33m";
export const LOG_COLOR_BLUE = "\x1b[34m";
export const LOG_COLOR_MAGENTA = "\x1b[35m";
export const LOG_COLOR_CYAN = "\x1b[36m";
export const LOG_COLOR_BLUE_BRIGHT = "\x1b[94m";

const LEVEL_TO_COLOR = new Map([
  // no color for "LOG_LEVEL_INFO" level (using default)
  [LOG_LEVEL_WARNING, LOG_COLOR_YELLOW],
  [LOG_LEVEL_ERROR, LOG_COLOR_RED]
]);

class ConsoleLogger {
  constructor(
    printTimeStamp = true,
    colorize = true,
    levelToColor = LEVEL_TO_COLOR
  ) {
    this._printTimeStamp = printTimeStamp;
    this._colorize = colorize;
    this._levelToColor = levelToColor;
  }

  colorizeMessage(message, color) {
    return color ? `${color}${message}\x1b[0m` : message;
  }

  padStartZero(value, length = 2) {
    return String(value).padStart(length, "0");
  }

  formatTime(ts) {
    return this.padStartZero(ts.getHours()) + ":" +
      this.padStartZero(ts.getMinutes()) + ":" +
      this.padStartZero(ts.getSeconds()) + "." +
      this.padStartZero(ts.getMilliseconds(), 3);
  }

  getListener() {
    return ({message, level, timeStamp, color}) => {
      // Using default level color if no specific color is passed
      let _color = color || this._levelToColor.get(level);
      let colorizedMessage = this._colorize ?
        this.colorizeMessage(message, _color) :
        message;
      let output = this._printTimeStamp ?
        `${this.formatTime(timeStamp)}: ${colorizedMessage}` :
        colorizedMessage;

      switch (level) {
        case LOG_LEVEL_INFO:
          console.info(output);
          break;

        case LOG_LEVEL_WARNING:
          console.warn(output);
          break;

        case LOG_LEVEL_ERROR:
          console.error(output);
          break;
      }
    };
  }
}

const CONSOLE_LOGGER = new ConsoleLogger().getListener();

export function emitLogEvent({message, level, color, timeStamp = new Date()}) {
  for (let listener of listeners) {
    listener({message, level, timeStamp, color});
  }
}

export function info(message, color) {
  emitLogEvent({message, level: LOG_LEVEL_INFO, color});
}

export function log(message, color) {
  emitLogEvent({message, level: LOG_LEVEL_INFO, color}); // also "info" level
}

export function warn(message, color) {
  emitLogEvent({message, level: LOG_LEVEL_WARNING, color});
}

export function error(message, color) {
  emitLogEvent({message, level: LOG_LEVEL_ERROR, color});
}

export let debugOptions;

const STORAGE_KEY = "ewe:debugOptions";
let savingPromise = Promise.resolve(null);
let storage = browser.storage.local;

export async function saveDebugOptions() {
  await savingPromise;

  let obj = {};
  obj[STORAGE_KEY] = JSON.stringify(debugOptions);
  savingPromise = storage.set(obj);
  await savingPromise;
}

export async function loadDebugOptions() {
  let obj = await storage.get(STORAGE_KEY);
  if (!obj || !obj[STORAGE_KEY]) {
    debugOptions = JSON.parse(JSON.stringify(defaultDebugOptions));
    return;
  }

  debugOptions = JSON.parse(obj[STORAGE_KEY]);
}

let initializationPromise;

export default {
  /**
   * Represents a debug log output entry.
   * @typedef {Object} LogEntry
   * @property {string} message Output message.
   * @property {number} level Log level.
  *                           Can be one of `LOG_LEVEL_...` values.
   * @property {Date} timeStamp Timestamp.
   * @property {string|null} color Specific color (ANSI terminal color).
  *                          Can be one of `LOG_COLOR_...` values or `null`.
   */

  /**
   * AddonInfo assigned during start.
   * @type {Object}
   * @property {string} name
   * @property {string} version
   */
  get addonInfo() {
    return {
      name: addonName,
      version: addonVersion,
      bundledSubscriptions: addonBundledSubscriptions,
      bundledSubscriptionsPath: addonBundledSubscriptionsPath,
      manifestVersion
    };
  },

  /**
   * Causes elements targeted by element hiding, element hiding emulation,
   * or snippets to be highlighted instead of hidden.
   * @param {boolean} enabled Enables or disables debug mode.
   * @returns {Promise} A promise that will resolve once the settings
   *    are saved.
   */
  async setElementHidingDebugMode(enabled) {
    await this.start();
    debugOptions.elemHide = enabled;
    await saveDebugOptions();
  },

  /**
   * Updates the element hiding debug style.
   * @param {Array} cssProperties The css properties for
   *                              the debug element.
   * @param {Array} snippetsCssProperties The css properties for
   *                                      the debug snippet element.
   * @returns {Promise} A promise that will resolve once the settings
   *    are saved.
   */
  async setElementHidingDebugStyle(cssProperties, snippetsCssProperties) {
    await this.start();

    if (cssProperties) {
      debugOptions.cssProperties = cssProperties;
    }

    if (snippetsCssProperties) {
      debugOptions.snippetsCssProperties = snippetsCssProperties;
    }

    await saveDebugOptions();
  },

  /**
   * Resets all of the debug options to their default state.
   * @returns {Promise}
   */
  async clearDebugOptions() {
    await this.start();
    debugOptions = JSON.parse(JSON.stringify(defaultDebugOptions));
    await saveDebugOptions();
  },

  /**
   * @ignore
   * @param {string} text
   */
  async isInFilterStorage(text) {
    let contents = [];
    await IO.readFromFile(FilterStorage.sourceFile,
                          line => contents.push(line));
    return contents.some(line => line.includes(text));
  },

  /**
   * @ignore
   * Used internally. Returns a list of warnings in the context of validating
   * that a user has provided the appropriate files to the extension.
   * @param {Array<Recommendation>} [addonInfo.bundledSubscriptions]
   *   A list of subscriptions provided by the integrator.
   * @param {string} [addonInfo.bundledSubscriptionsPath]
   *   A path to subscription files provided by the integrator.
   * @return {Array<String>}
   */
  validateSubscriptions: validate,

  /**
   * @ignore
   * Used internally. Waits for any pending save actions to complete.
   * @return {Promise} The promise that is resolved once the filter storage
   *   module has saved all items.
   */
  async ensureEverythingHasSaved() {
    let {filterStorage} = filterEngine;
    if (filterStorage) {
      // It would be better if filterStorage gave a promise to await for this.
      // https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/464
      while (filterStorage._saving) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    await awaitSavingComplete();
  },

  /**
   * @ignore
   * Initialize debugging.
   */
  async start() {
    if (!initializationPromise) {
      initializationPromise = loadDebugOptions();
    }
    return initializationPromise;
  },

  /**
   * @ignore
   * Return the promise for saving the debugging options.
   * @return {Promise}
   */
  async ensureSaved() {
    await savingPromise;
  },

  /**
   * Emitted when having debug output.
   * @event
   * @type {EventDispatcher<LogEntry>}
   */
  onLogEvent: new DebugEventDispatcher(),

  /**
   * Configurable logger (class) that outputs to console
   */
  ConsoleLogger,

  /**
   * Default logger instance that outputs to console
   */
  CONSOLE_LOGGER
};

