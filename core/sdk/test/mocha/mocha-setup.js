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

/* global Mocha */

/* eslint-disable mocha/no-top-level-hooks */

import {TEST_PAGES_URL} from "../test-server-urls.js";
import {Page, Popup, setMinTimeout, isIncognito} from "../utils.js";
import {runInBackgroundPage, getLastError, clearAllTestEvents,
        resetFeatureFlags} from "../messaging.js";
import {isFuzzingServiceWorker} from "./mocha-runner.js";

import "./mocha-setup-minimal.js";

async function clearFilters() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_removeAllSubscriptions"},
    {op: "await"}
  ], false);
}

async function clearDebugLog() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_clearDebugLog"},
    {op: "await"}
  ], false);
}

async function printDebugLog() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_printDebugLog"},
    {op: "await"}
  ], false);
}

async function clearStorage() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_clearStorage"},
    {op: "await"}
  ], false);
}

async function clearFrameState() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_clearFrameState"},
    {op: "await"}
  ], false);
}

before(async function() {
  setMinTimeout(this, 7000);

  try {
    await fetch(TEST_PAGES_URL);
  }
  catch (err) {
    let elem = document.getElementById("test-pages-status");
    let message =
      `Warning: Test pages server can't be reached at ${TEST_PAGES_URL}`;
    elem.style.display = "block";
    elem.textContent = message;
    Mocha.reporters.Base.consoleLog("\x1b[33m%s\x1b[0m", message);
  }

  await clearFilters();
  await clearStorage();
  await resetFeatureFlags();

  // The incognito CI job would sometimes fail the first test case for no
  // apparent reason. Sleeping should allow more time for the test extension
  // to be "ready".
  if (isIncognito()) {
    await new Promise(r => setTimeout(r, 2000));
  }
});

beforeEach(async function() {
  await clearDebugLog();

  let {fn} = this.currentTest;
  this.currentTest.fn = async function() {
    await fn.call(this);
    let error = await getLastError();
    if (error) {
      // https://github.com/mozilla/webextension-polyfill/issues/384
      if (error.includes("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received")) {
        console.warn(error);
      }
      else {
        throw new Error(error);
      }
    }
  };
});

afterEach(async function() {
  if (this.currentTest.isPending()) {
    return;
  }

  if (this.currentTest.isFailed()) {
    console.warn(`Test "${this.currentTest.title}" failed.\nDebug output:`);
    await printDebugLog();

    // wait for all the console messages (trace) to be printed
    await new Promise(r => setTimeout(r, 1000));
  }

  setMinTimeout(this, isFuzzingServiceWorker() ? 12000 : 10000);
  await clearFilters();
  await clearStorage();
  await resetFeatureFlags();
  await Page.removeCurrent();
  await clearFrameState();
  await Popup.removeCurrent();
  clearAllTestEvents();
});
