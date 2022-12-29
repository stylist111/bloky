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

// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

describe("Reporting scheduler", function() {
  let apiPrivate;
  let api;
  let prefs;
  let testFinishDelay = 3000; // 3 seconds

  async function mockAndImport() {
    apiPrivate = await mock("reporting-scheduler.js");
    api = apiPrivate.default;
  }

  beforeEach(async function() {
    await env.configure();
    prefs = {};
    env.setPrefs(prefs);
    await mockAndImport();
  });

  afterEach(function() {
    if (!api)
      return;

    apiPrivate.stop();
  });

  it("checks immediately if no last timestamp provided", async function() {
    const LAST_CHECK_TIMESTAMP = -1;
    prefs.last_reporting_check_timestamp = LAST_CHECK_TIMESTAMP;

    // the actual values do not matter
    env.browser.declarativeNetRequest = {
      GETMATCHEDRULES_QUOTA_INTERVAL: 10, // minutes
      MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL: 20 // times
    };

    let callbackCalled = false;
    let callbackLastCheckTimestamp = null;
    let callback = lastCheckTimestamp => {
      callbackCalled = true;
      callbackLastCheckTimestamp = lastCheckTimestamp;
    };

    await api.start(callback);

    // `start()` is non-blocking so we might need to let callback be called
    await new Promise(r => setTimeout(r, 0));

    expect(callbackCalled).toEqual(true);
    expect(callbackLastCheckTimestamp).toEqual(LAST_CHECK_TIMESTAMP);
  });

  it("delays the first check if last check was not that long time ago", async function() {
    let checkIntervalMillis = 5000 + apiPrivate.BUFFER;
    let firstTestCheck = 1000;
    this.timeout(checkIntervalMillis + firstTestCheck + testFinishDelay);

    const LAST_CHECK_TIMESTAMP = Date.now();
    prefs.last_reporting_check_timestamp = LAST_CHECK_TIMESTAMP;

    // Calls per minute.
    let quota = 1;

    // The amount of calls within the above interval.
    let calls = 1000 * quota * 60 / (checkIntervalMillis - apiPrivate.BUFFER);
    env.browser.declarativeNetRequest = {
      GETMATCHEDRULES_QUOTA_INTERVAL: quota,
      MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL: calls
    };

    expect(apiPrivate.getCheckInterval()).toEqual(checkIntervalMillis);

    let callbackCalled = false;
    let callbackLastCheckTimestamp = null;
    let actualDelayIntervalMillis = 0;
    let callback = lastCheckTimestamp => {
      if (actualDelayIntervalMillis)
        return;
      actualDelayIntervalMillis = Date.now() - LAST_CHECK_TIMESTAMP;

      callbackCalled = true;
      callbackLastCheckTimestamp = lastCheckTimestamp;
    };

    await api.start(callback);
    await new Promise(r => setTimeout(r, 1000));

    expect(callbackCalled).toEqual(false);

    await new Promise(r => setTimeout(r, checkIntervalMillis));
    expect(callbackCalled).toEqual(true);
    expect(callbackLastCheckTimestamp).toEqual(LAST_CHECK_TIMESTAMP);
    expect(actualDelayIntervalMillis >= checkIntervalMillis).toEqual(true);
  });

  it("keeps checking with interval", async function() {
    let checkIntervalMillis = 2000 + apiPrivate.BUFFER;
    let attempts = 3;
    this.timeout(attempts * checkIntervalMillis +
      checkIntervalMillis / 2 + testFinishDelay);

    prefs.last_reporting_check_timestamp = 0; // don't delay the first run

    // Calls per minute.
    let quota = 1;

    // The amount of calls within the above interval.
    let calls = 1000 * quota * 60 / (checkIntervalMillis - apiPrivate.BUFFER);
    env.browser.declarativeNetRequest = {
      GETMATCHEDRULES_QUOTA_INTERVAL: quota,
      MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL: calls
    };

    expect(apiPrivate.getCheckInterval()).toEqual(checkIntervalMillis);

    let checkTimestamps = [];
    let callback = lastCheckTimestamp => {
      checkTimestamps.push(Date.now());
    };

    await api.start(callback);

    await new Promise(r => setTimeout(r, attempts * checkIntervalMillis +
      checkIntervalMillis / 2));

    expect(checkTimestamps.length > 1).toEqual(true);
  });
});
