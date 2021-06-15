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

mocha.setup("bdd");

let timeout = new URLSearchParams(document.location.search).get("timeout");
let background;
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

  background = await browser.runtime.getBackgroundPage();
  self.EWE = background.EWE;
  restoreSubscriptions = EWE.subscriptions.removeAll();
});

after(() =>
{
  if (restoreSubscriptions)
    restoreSubscriptions();
});

beforeEach(function()
{
  let {fn} = this.currentTest;
  this.currentTest.fn = function()
  {
    let result = fn.call(this);
    if (!result || typeof result.then != "function")
      return result;

    return new Promise((resolve, reject) =>
    {
      function onError(event) { reject(event.error); }
      function onMessageError(event) { reject(event); }
      function onRejection(event) { reject(event.reason); }

      background.addEventListener("error", onError);
      background.addEventListener("messageerror", onMessageError);
      background.addEventListener("unhandledrejection", onRejection);

      result.then(resolve, reject).then(() =>
      {
        background.removeEventListener("error", onError);
        background.removeEventListener("messageerror", onMessageError);
        background.removeEventListener("unhandledrejection", onRejection);
      });
    });
  };
});

afterEach(() => EWE.subscriptions.removeAll());
