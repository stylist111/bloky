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

/* eslint-env webextensions, serviceworker */

"use strict";

if (typeof EWE == "undefined" && typeof importScripts != "undefined")
  importScripts("ewe-api.js");

let callbackIdCounter = 0;
let callbacks = new Map();
let lastError;

function toStringIfError(obj)
{
  return obj instanceof Error ? obj.toString() : obj;
}

async function runOperations(operations)
{
  let stack = [];

  for (let {op, arg} of operations)
  {
    switch (op)
    {
      case "getGlobal":
        stack.push(self[arg]);
        break;

      case "getProp":
        stack.push(stack.pop()[arg]);
        break;

      case "pushArg":
        stack.push(arg);
        break;

      case "callMethod":
        let obj = stack.shift();
        let args = stack.splice(0);
        stack.push(obj[arg](...args));
        break;

      case "await":
        stack.push(await stack.pop());
        break;

      case "pushCallback":
        stack.push(callbacks.get(arg));
        break;

      case "getLastError":
        stack.push(lastError);
        lastError = null;
        break;
    }
  }

  return stack.pop();
}

function handleTestMessage(request, sender, sendResponse)
{
  switch (request.type)
  {
    case "ewe-test:run":
      runOperations(request.operations).then(
        res => sendResponse({result: toStringIfError(res)}),
        err => sendResponse({error: toStringIfError(err)})
      );
      return true;

    case "ewe-test:make-callback":
      let id = ++callbackIdCounter;
      let tabId = sender.tab.id;

      callbacks.set(id, (...args) =>
      {
        let message = {type: "ewe-test:call-callback", id, args};
        chrome.tabs.sendMessage(tabId, message);
      });
      sendResponse(id);
      break;

    case "ewe-test:setLanguageAndStart":
      self.uiLanguageOverride = request.args[0];
      EWE.start().then(started => sendResponse({result: started}));
      break;

    case "ewe-test:deleteUiLanguageOverride":
      delete self.uiLanguageOverride;
      sendResponse({});
      return true;
  }
}

chrome.runtime.onMessage.addListener(handleTestMessage);

addEventListener("error", ({error}) => lastError = error);
addEventListener("unhandledrejection", ({reason}) => lastError = reason);

function mockGetUILanguage(api)
{
  let {getUILanguage} = api.i18n;
  if (getUILanguage)
    api.i18n.getUILanguage = () => self.uiLanguageOverride || getUILanguage();
  else
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1159438
    console.error("getUILanguage is not available");
}

mockGetUILanguage(chrome);
if (typeof browser != "undefined")
  mockGetUILanguage(browser);

EWE.start().then(async() =>
{
  if (typeof netscape != "undefined")
  {
    let version = /\brv:([^;)]+)/.exec(navigator.userAgent)[1];
    if (parseInt(version, 10) < 86)
      await new Promise(resolve => setTimeout(resolve, 2000));
  }

  chrome.tabs.create({url: "index.html"});
  if (localStorage.getItem("reload-test-running"))
    chrome.tabs.create({url: "reload.html"});
});
