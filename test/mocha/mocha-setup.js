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

import {TEST_PAGES_URL, Page, Popup, setMinTimeout, isIncognito}
  from "../utils.js";
import {runInBackgroundPage, ensureEverythingHasSaved,
        clearAllTestEvents} from "../messaging.js";
import {isFuzzingServiceWorker} from "./mocha-runner.js";

import "./mocha-setup-minimal.js";

async function clearFilters() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_removeAllSubscriptions"},
    {op: "await"}
  ], false);

  await ensureEverythingHasSaved();
}

async function clearStorage() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_clearStorage"},
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

  // The incognito CI job would sometimes fail the first test case for no
  // apparent reason. Sleeping should allow more time for the test extension
  // to be "ready".
  if (isIncognito())
    await new Promise(r => setTimeout(r, 2000));
});

beforeEach(async function() {
  let {fn} = this.currentTest;
  this.currentTest.fn = async function() {
    await fn.call(this);

    let error = await runInBackgroundPage([{op: "getLastError"}], false);
    if (error) {
      // https://github.com/mozilla/webextension-polyfill/issues/384
      if (error.includes("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"))
        console.warn(error);
      else
        throw new Error(error.message);
    }
  };
});

afterEach(async function() {
  setMinTimeout(this, isFuzzingServiceWorker() ? 8000 : 5000);
  await clearFilters();
  await clearStorage();
  await Page.removeCurrent();
  await Popup.removeCurrent();
  clearAllTestEvents();
});
