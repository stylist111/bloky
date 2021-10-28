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

import {TEST_PAGES_URL} from "../utils.js";
import {callMethod, runInBackgroundPage, removeFakeListeners}
  from "../messaging.js";

mocha.setup("bdd");

let timeout = new URLSearchParams(document.location.search).get("timeout");
let restoreSubscriptions;

if (timeout)
  mocha.timeout(parseInt(timeout, 10));

before(async function()
{
  this.timeout(5000);

  try
  {
    await fetch(TEST_PAGES_URL);
  }
  catch (err)
  {
    let elem = document.getElementById("test-pages-status");
    let message =
      `Warning: Test pages server can't be reached at ${TEST_PAGES_URL}`;
    elem.style.display = "block";
    elem.textContent = message;
    mocha.Mocha.reporters.Base.consoleLog("\x1b[33m%s\x1b[0m", message);
  }
  restoreSubscriptions = await callMethod(["subscriptions"], "removeAll");
});

after(function()
{
  this.timeout(3000);

  if (restoreSubscriptions)
    restoreSubscriptions();
});

beforeEach(function()
{
  let {fn} = this.currentTest;
  this.currentTest.fn = async function()
  {
    await fn.call(this);

    let error = await runInBackgroundPage([{op: "getLastError"}]);
    if (error)
      throw new Error(error);
  };
});

afterEach(async() =>
{
  await callMethod(["subscriptions"], "removeAll");
  await removeFakeListeners();
});
