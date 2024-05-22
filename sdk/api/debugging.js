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
import * as prefs from "./prefs.js";
import * as sitekey from "./sitekey.js";
import * as contentMessageDeferrer from "./content-message-deferrer.js";
import * as cdp from "./cdp.js";
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

/**
 * @ignore
 */
export const LOG_LEVEL_INFO = 0;

/**
 * @ignore
 */
export const LOG_LEVEL_DEBUG = 1;

/**
 * @ignore
 */
export const LOG_LEVEL_WARNING = 2;

/**
 * @ignore
 */
export const LOG_LEVEL_ERROR = 3;

/**
 * @ignore
 */
export const LOG_LEVEL_TRACE = 4;

/**
 * @ignore
 */
export const LOG_COLOR_RED = "\x1b[31m";

/**
 * @ignore
 */
export const LOG_COLOR_GREEN = "\x1b[32m";

/**
 * @ignore
 */
export const LOG_COLOR_YELLOW = "\x1b[33m";

/**
 * @ignore
 */
export const LOG_COLOR_BLUE = "\x1b[34m";

/**
 * @ignore
 */
export const LOG_COLOR_MAGENTA = "\x1b[35m";

/**
 * @ignore
 */
export const LOG_COLOR_CYAN = "\x1b[36m";

/**
 * @ignore
 */
export const LOG_COLOR_BLUE_BRIGHT = "\x1b[94m";

const LEVEL_TO_COLOR = new Map([
  // no color for "LOG_LEVEL_INFO" level (using default)
  [LOG_LEVEL_DEBUG, LOG_COLOR_BLUE],
  [LOG_LEVEL_WARNING, LOG_COLOR_YELLOW],
  [LOG_LEVEL_ERROR, LOG_COLOR_RED],
  [LOG_LEVEL_TRACE, LOG_COLOR_BLUE]
]);

/**
 * Collects the debugging events until print() is called.
 */
class OnRequestLogger {
  constructor(listener) {
    this._wrappedListener = listener;
    this._events = [];
    let self = this;
    this._listener = event => {
      self._events.push(event);
    };
  }

  print() {
    for (let event of this._events) {
      this._wrappedListener(event);
    }
  }

  clear() {
    this._events = [];
  }

  getListener() {
    return this._listener;
  }
}

class ConsoleLogger {
  constructor(
    printTimeStamp = true,
    colorize = true,
    levelToColor = LEVEL_TO_COLOR
  ) {
    this._printTimeStamp = printTimeStamp;
    this._colorize = colorize;
    this._levelToColor = levelToColor;
    this._listener = ({message, level, timeStamp, color}) => {
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

        case LOG_LEVEL_DEBUG:
        case LOG_LEVEL_TRACE:
          console.debug(output);
          break;
      }
    };
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
    return this._listener;
  }
}

const CONSOLE_LOGGER = new ConsoleLogger();
const ON_REQUEST_CONSOLE_LOGGER =
  new OnRequestLogger(CONSOLE_LOGGER.getListener());

function getStackTrace() {
  const stack = new Error().stack.split("\n")
    .slice(3) // skip "Error" line, getStackTrace() and trace()
    .map(it => it
      .trim()
      .replace("at ", ""));
  return stack;
}

function getMessage(messageOrCallback) {
  return typeof messageOrCallback === "string" ?
    messageOrCallback :
    messageOrCallback();
}

function _trace(messageOrCallback, level, color) {
  if (listeners.length) {
    const message = getMessage(messageOrCallback);
    emitLogEvent({message, level, color});
  }
}

/**
 * @ignore
 */
export function emitLogEvent({message, level, color, timeStamp = new Date()}) {
  for (let listener of listeners) {
    listener({message, level, timeStamp, color});
  }
}

/**
 * Outputs 'information' message
 * @ignore
 * @param {string|function} messageOrCallback Log message or a callback
 *                                            that returns log message
 * @param {*} color Log output color
 */
export function info(messageOrCallback, color) {
  _trace(messageOrCallback, LOG_LEVEL_INFO, color);
}

/**
 * Outputs 'debug' message
 * @ignore
 * @param {string|function} messageOrCallback Log message or a callback
 *                                            that returns log message
 * @param {*} color Log output color
 */
export function debug(messageOrCallback, color) {
  _trace(messageOrCallback, LOG_LEVEL_DEBUG, color);
}

/**
 * Outputs 'log' message
 * @ignore
 * @param {string|function} messageOrCallback Log message or a callback
 *                                            that returns log message
 * @param {*} color Log output color
 */
export function log(messageOrCallback, color) {
  _trace(messageOrCallback, LOG_LEVEL_INFO, color);
}

/**
 * Outputs 'warning' message
 * @ignore
 * @param {string|function} messageOrCallback Log message or a callback
 *                                            that returns log message
 * @param {*} color Log output color
 */
export function warn(messageOrCallback, color) {
  _trace(messageOrCallback, LOG_LEVEL_WARNING, color);
}

/**
 * Outputs 'error' message
 * @ignore
 * @param {string|function} messageOrCallback Log message or a callback
 *                                            that returns log message
 * @param {*} color Log output color
 */
export function error(messageOrCallback, color) {
  _trace(messageOrCallback, LOG_LEVEL_ERROR, color);
}

/**
 * Outputs call track and the arguments
 * @ignore
 * @param {Object} args Call arguments
 * @param {*?} color Log output color
 */
export function trace(args, color) {
  if (listeners.length) {
    let stackTrace = getStackTrace();
    stackTrace.push(JSON.stringify(args));
    const message = stackTrace.join("\n\t");
    _trace(message, LOG_LEVEL_TRACE, color);
  }
}

/**
 * @ignore
 */
export let debugOptions;

const STORAGE_KEY = "ewe:debugOptions";
let savingPromise = Promise.resolve(null);
let storage = browser.storage.local;

/**
 * @ignore
 */
export async function saveDebugOptions() {
  await savingPromise;

  let obj = {};
  obj[STORAGE_KEY] = JSON.stringify(debugOptions);
  savingPromise = storage.set(obj);
  await savingPromise;
}

/**
 * @ignore
 */
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
   * @ignore
   * Represents a debug log output entry.
   * @typedef {Object} LogEntry
   * @property {string} message Output message.
   * @property {number} level Log level.
   *                          Can be one of `LOG_LEVEL_...` values.
   * @property {Date} timeStamp Timestamp.
   * @property {string|null} color Specific color (ANSI terminal color).
   *                         Can be one of `LOG_COLOR_...` values or `null`.
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
    await prefs.awaitSavingComplete();
    await filterEngine.filterStorage.awaitSavingComplete();
    await sitekey._awaitSavingComplete();
    await contentMessageDeferrer._awaitSavingComplete();
    await cdp._awaitSavingComplete();
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
  CONSOLE_LOGGER,

  /**
   * On request logger, that outputs to wrapped logger on `print()`
   */
  OnRequestLogger,

  /**
   * Default logger instance, that outputs to console on `print()`
   */
  ON_REQUEST_CONSOLE_LOGGER
};

