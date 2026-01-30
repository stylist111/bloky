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

/* eslint-disable no-console */

const MAX_LOGS = 1000;
let logs = [];

// Session start time - set once when background starts
const sessionStartTime = Date.now();

function captureLog(level, ...args) {
  const message = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === "object") {
      try {
        return JSON.stringify(arg);
      }
      catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(" ");

  logs.push({
    timestamp: Date.now(),
    level,
    message
  });

  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
}

// Override console methods to capture logs
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
};

console.log = (...args) => {
  captureLog("info", ...args);
  originalConsole.log(...args);
};

console.info = (...args) => {
  captureLog("info", ...args);
  originalConsole.info(...args);
};

console.warn = (...args) => {
  captureLog("warn", ...args);
  originalConsole.warn(...args);
};

console.error = (...args) => {
  captureLog("error", ...args);
  originalConsole.error(...args);
};

console.debug = (...args) => {
  captureLog("debug", ...args);
  originalConsole.debug(...args);
};

/**
 * Get all captured logs with session info.
 * @returns {{sessionStartTime: number, logs: Array}}
 */
export function getLogs() {
  return {sessionStartTime, logs};
}

/**
 * Clear all captured logs.
 */
export function clearLogs() {
  logs = [];
}
