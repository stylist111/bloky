/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

mocha.setup("bdd");

let timeout = new URLSearchParams(document.location.search).get("timeout");
let background;
let restoreSubscriptions;

if (timeout)
  mocha.timeout(parseInt(timeout, 10));

before(async() =>
{
  background = await browser.runtime.getBackgroundPage();
  self.ABP = background.ABP;
  restoreSubscriptions = ABP.subscriptions.removeAll();
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

afterEach(() => ABP.subscriptions.removeAll());
