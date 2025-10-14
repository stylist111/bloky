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

import browser from "../browser.js";

import {AbstractLogger, logLevelNumbersToNames, logLevelNamesToNumbers}
  from "../../all/telemetry.js";
import {Prefs, init as initializePrefs} from "../prefs.js";
import {PersistentState} from "../persistence.js";
import {EventDispatcher} from "../types.js";

// Console logging is primarily for devs who are currently adding logging to
// be able to see the logs, or for devs trying to reproduce something that
// they saw in the server logs.
let consoleLogLevel = new PersistentState(
  "ewe:telemetry-logging-console-level",
  browser.storage.local
);

// This is configured through ab-testing-config's experiments.json file.
let serverLogLevel = new PersistentState(
  "ewe:telemetry-logging-server-level",
  browser.storage.local
);

/**
 * Sets the intended server logging levels.
 *
 * If both the global log level and a module-specific log level are set, the
 * most verbose one takes priority.
 *
 * Setting the log level implies that all less verbose levels are also
 * enabled. For example, enabling "info" logging will also enable "behavior"
 * and "warn" logging.
 *
 * This overrides any existing server log level.
 *
 * @param {object} newLevels
 * @param {string?} newLevels.global The level you want to log at. Can be one of
 *   "debug", "info", "behavior", "warn", or "off".
 * @param {object?} newLevels.byModule Logging levels for specific modules. keys
 *   are module names and the values are the logging level, can be one of
 *   "debug", "info", "behavior", "warn", or "off".
 * @returns {Promise} Promise that resolves when the setting is set.
 *
 * @ignore
 */
export async function setServerLogLevel(newLevels) {
  let config = await serverLogLevel.getStateLoaded();

  config.global = logLevelNamesToNumbers[newLevels.global];

  config.byModule = {};
  if (newLevels.byModule) {
    for (const [module, level] of Object.entries(newLevels.byModule)) {
      config.byModule[module] = logLevelNamesToNumbers[level];
    }
  }

  await serverLogLevel.save();
}

let pendingServerLogState = new PersistentState(
  "ewe:telemetry-logging-pending",
  browser.storage.local
);

let behaviourCountState = new PersistentState(
  "ewe:telemetry-behaviour-counts",
  browser.storage.local
);

async function trackBehaviourEvent(module, event, ipmId) {
  let state = await behaviourCountState.getStateLoaded();

  if (!state.counts) {
    state.counts = {};
  }

  const key = ipmId ? `${module}:${event}:${ipmId}` : `${module}:${event}`;
  state.counts[key] = (state.counts[key] || 0) + 1;
  await behaviourCountState.save();
}

/**
 * @ignore
 */
export async function startUploadTransaction() {
  let state = await pendingServerLogState.getStateLoaded();
  if (!state.logs) {
    state.logs = [];
  }
  state.uploadTransactionIndex = state.logs.length;

  let logs = state.logs.slice();
  await pendingServerLogState.save();
  return logs;
}

/**
 * @ignore
 */
export async function commitUploadTransaction() {
  let state = await pendingServerLogState.getStateLoaded();
  if (!state.uploadTransactionIndex) {
    return;
  }

  state.logs.splice(0, state.uploadTransactionIndex);
  delete state.uploadTransactionIndex;
  await pendingServerLogState.save();
}

/**
 * @ignore
 */
export async function abortUploadTransaction() {
  let state = await pendingServerLogState.getStateLoaded();
  if (!state.uploadTransactionIndex) {
    return;
  }

  delete state.uploadTransactionIndex;
  await pendingServerLogState.save();
}

/**
 * @ignore
 */
export async function hasPendingLogs() {
  let state = await pendingServerLogState.getStateLoaded();
  return state.logs && state.logs.length > 0;
}

/**
 * @ignore
 */
export let onLogQueued = new EventDispatcher(dispatch => {});

function loggingEnabled(module, level, loggingConfig) {
  let possibleLevels = [
    loggingConfig.global,
    loggingConfig.byModule ? loggingConfig.byModule[module] : null
  ];

  const result = possibleLevels.some(
    configLevel => configLevel && level >= configLevel
  );
  return result;
}

async function consoleLog(logTime, module, level, event, data, ipmId) {
  if (loggingEnabled(module, level, await consoleLogLevel.getStateLoaded())) {
    const logParams = [
      logTime,
      module,
      logLevelNumbersToNames[level],
      event];

    if (typeof data !== "undefined" && data !== null) {
      logParams.push(data);
    }

    if (typeof ipmId !== "undefined") {
      logParams.push(`ipmId: ${ipmId}`);
    }

    // eslint-disable-next-line no-console
    console.log(...logParams);
  }
}

async function queueServerLog(logTime, module, level, event, data) {
  await initializePrefs();

  if (Prefs.telemetry_opt_out) {
    return;
  }

  if (!loggingEnabled(module, level, await serverLogLevel.getStateLoaded())) {
    return;
  }

  let state = await pendingServerLogState.getStateLoaded();
  if (!state.logs) {
    state.logs = [];
  }

  state.logs.push({
    timestamp: logTime,
    module,
    level: logLevelNumbersToNames[level],
    event,
    data
  });
  await pendingServerLogState.save();

  onLogQueued.emit();
}

/**
 * @ignore
 * Records an event.
 *
 * Depending on the current logging config, this may send the log to a remote
 * server, or print the log on the console.
 *
 * There may be internal asynchronous processes before the log is actually sent
 * anywhere or displayed on the console, so don't expect logs to have happened
 * already when this function returns.
 *
 * @param {string} logTime When this log occurred.
 * @param {string} module The module in which the event occurred.
 * @param {number} level The logging level, from 1=debug to 4=warn.
 * @param {string} event The event being logged. This should be unique.
 * @param {string|number|Object|Array|boolean} [data]
 * @param {string} [ipmId] Optional IPM ID to associate with this event.
 */
export function serverLogValidatedEvent(
  logTime, module, level, event, data, ipmId
) {
  if (level === logLevelNamesToNumbers.behavior) {
    void trackBehaviourEvent(module, event, ipmId);
  }

  void consoleLog(logTime, module, level, event, data, ipmId);
  void queueServerLog(logTime, module, level, event, data);
}

/**
 * Represents a server logger. This is used to send data to a our
 * telemetry server. The exact URL will be configured in this file's
 * start function. Console logging is also provided for convenience.
 *
 * @param {string} module The module that this logger is for.
 */
export class ServerLogger extends AbstractLogger {
  constructor(module) {
    super(module);
  }

  _validatedLog(logTime, level, event, data, ipmId) {
    serverLogValidatedEvent(logTime, this._module, level, event, data, ipmId);
  }
}

/**
 * Resets the server logging level to "off".
 * @returns {Promise} Promise that resolves when the setting is set.
 *
 * @ignore
 */
export async function resetServerLogLevel() {
  serverLogLevel.clearState();
  await serverLogLevel.save();
}

/**
 * Resets the console logging level to "off".
 * @returns {Promise} Promise that resolves when the setting is set.
 * @memberof telemetry
 */
export async function resetConsoleLogLevel() {
  consoleLogLevel.clearState();
  await consoleLogLevel.save();
}

/**
 * Gets the current behaviour logging state with call counts
 * @returns {Promise<Object>} Object with event names as keys and counts
 *   as values
 * @ignore
 */
export async function getBehaviourLoggingState() {
  let state = await behaviourCountState.getStateLoaded();
  return state.counts || {};
}

/**
 * Clears the behaviour logging state
 * @returns {Promise<void>}
 * @ignore
 */
export async function clearBehaviourLoggingState() {
  behaviourCountState.clearState();
  await behaviourCountState.save();
}

/**
 * Sets the intended console logging level.
 *
 * If both the global log level and a module-specific log level are set, the
 * most verbose one takes priority.
 *
 * Setting the log level implies that all less verbose levels are also
 * enabled. For example, enabling "info" logging will also enable "behavior"
 * and "warn" logging.
 *
 * @param {string} level The level you want to log at. Can be one of
 *                       "debug", "info", "behavior", "warn", or "off".
 * @param {string?} module The specific module you want to set the log level
 *                         for. Not passing this sets the global log level.
 * @returns {Promise} Promise that resolves when the setting is set.
 * @memberof telemetry
 */
export async function setConsoleLogLevel(level, module) {
  let newLevel = logLevelNamesToNumbers[level];
  if (!newLevel) {
    throw new Error(`Unknown log level: ${level}`);
  }

  let config = await consoleLogLevel.getStateLoaded();

  if (module) {
    if (newLevel == logLevelNamesToNumbers.off) {
      if (config.byModule) {
        delete config.byModule[module];
      }
    }
    else {
      if (!config.byModule) {
        config.byModule = {};
      }

      config.byModule[module] = newLevel;
    }
  }
  else if (newLevel == logLevelNamesToNumbers.off) {
    delete config.global;
  }
  else {
    config.global = newLevel;
  }

  await consoleLogLevel.save();
}

/**
 * @ignore
 * @param {boolean} value The new opt out value
 */
export async function setOptOut(value) {
  if (value) {
    pendingServerLogState.clearState();
    await pendingServerLogState.save();
  }
}
