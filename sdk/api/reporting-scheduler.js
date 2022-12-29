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
import {init as initPrefs, Prefs} from "./prefs.js";

let callback;
let timer;
export const BUFFER = 10000; // This is to protect against timing inaccuracies.

export function getCheckInterval() {
  return (1000 *
    browser.declarativeNetRequest.GETMATCHEDRULES_QUOTA_INTERVAL * 60 /
    browser.declarativeNetRequest.MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL) +
    BUFFER;
}

function schedule(intervalMillis) {
  // protection from the wallclock being updated
  let safeInterval = Math.min(Math.max(0, intervalMillis), 60000);
  timer = setTimeout(check, safeInterval);
}

async function check() {
  if (!timer)
    return;

  let lastCheckTimestamp = Prefs.last_reporting_check_timestamp;
  let thisCheckTimestamp = Date.now();
  try {
    await callback(lastCheckTimestamp);
  }
  finally {
    Prefs.last_reporting_check_timestamp = thisCheckTimestamp;
    schedule(getCheckInterval());
  }
}

async function start(checkCallback) {
  if (timer)
    return;

  callback = checkCallback;

  await initPrefs();

  // Due to service worker restarting behaviour it can happen
  // that we start requesting earlier than it is allowed by Chromium.
  // So we might need to delay the first check.
  let nextCheckTimestamp =
    Prefs.last_reporting_check_timestamp + getCheckInterval();
  schedule(nextCheckTimestamp - Date.now());
}

export function stop() {
  if (!timer)
    return;

  clearTimeout(timer);
  timer = null;
}

export default {
  /**
   * Start checking with predefined interval
   * @param {function} callback A function to be called for the check.
   * @returns {Promise} starting promise.
   */
  start
};
