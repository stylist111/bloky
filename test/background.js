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

// This is state that deliberately is not backed by storage so we can
// be sure that our MV3 service worker tests can suspend the service
// worker.
let inMemoryState = null;

function toStringIfError(obj) {
  return obj instanceof Error ? obj.toString() : obj;
}

async function runOperations(operations) {
  let stack = [];

  for (let {op, arg} of operations) {
    switch (op) {
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

      case "stringifyMap":
        stack.push(JSON.stringify(Object.fromEntries(stack.pop())));
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

let TEST_EVENT_STORAGE_KEY = "ewe-test:test-event-map";
class TestEventMap {
  constructor() {
    this.loaded = new Promise(resolve => {
      if (chrome.storage.session) {
        chrome.storage.session.get([TEST_EVENT_STORAGE_KEY], results => {
          this.data = results[TEST_EVENT_STORAGE_KEY] || {};
          resolve();
        });
      }
      else {
        this.data = {};
        resolve();
      }
    });
  }

  saveSessionStorage() {
    return new Promise(resolve => {
      if (chrome.storage.session) {
        chrome.storage.session.set({
          [TEST_EVENT_STORAGE_KEY]: this.data
        }, resolve);
      }
      else {
        resolve();
      }
    });
  }

  async push(name, eventArgs) {
    await this.loaded;

    if (!this.data[name])
      this.data[name] = [];

    this.data[name].push(eventArgs);

    await this.saveSessionStorage();
  }

  async get(name) {
    await this.loaded;

    if (this.data[name])
      return this.data[name];

    return [];
  }

  async clear(name) {
    await this.loaded;

    delete this.data[name];
    await this.saveSessionStorage();
  }

  async clearAll() {
    await this.loaded;

    this.data = {};
    await this.saveSessionStorage();
  }
}

self.testEvents = new TestEventMap();
function createTestEventListener(name) {
  return async function(...eventArgs) {
    await self.testEvents.push(name, eventArgs);
  };
}

let messages = [];

function handleTestMessage(request, sender, sendResponse) {
  messages.push({request, sender});
  switch (request.type) {
    case "ewe-test:run":
      runOperations(request.operations).then(
        res => sendResponse({result: toStringIfError(res)}),
        err => sendResponse({error: toStringIfError(err)})
      );
      return true;

    case "ewe-test:make-callback":
      let id = ++callbackIdCounter;
      let tabId = sender.tab.id;

      callbacks.set(id, (...args) => {
        let message = {type: "ewe-test:call-callback", id, args};
        chrome.tabs.sendMessage(tabId, message);
      });
      sendResponse(id);
      break;

    case "ewe-test:getMessages": {
      sendResponse(messages.map(arg => arg.request));
      return true;
    }

    case "ewe-test:clearMessages": {
      messages = [];
      sendResponse({});
      return true;
    }

    case "ewe-test:setInMemoryState": {
      inMemoryState = request.data;
      sendResponse({});
      return true;
    }

    case "ewe-test:getInMemoryState": {
      sendResponse(inMemoryState);
      return true;
    }
  }
  return true;
}

chrome.runtime.onMessage.addListener(handleTestMessage);

addEventListener("error", ({error}) => lastError = error);
addEventListener("unhandledrejection", ({reason}) => lastError = reason);

EWE.filters.onAdded.addListener(createTestEventListener("filters.onAdded"));
EWE.filters.onChanged.addListener(createTestEventListener("filters.onChanged"));
EWE.filters.onRemoved.addListener(createTestEventListener("filters.onRemoved"));
EWE.subscriptions.onAdded.addListener(createTestEventListener("subscriptions.onAdded"));
EWE.subscriptions.onChanged.addListener(createTestEventListener("subscriptions.onChanged"));
EWE.subscriptions.onRemoved.addListener(createTestEventListener("subscriptions.onRemoved"));

async function checkTabAllowlisted(tabId, changeInfo, tab) {
  let result = {
    tabId,
    url: tab.url
  };
  try {
    result.isResourceAllowlisted = await EWE.filters.isResourceAllowlisted(
      tab.url, "document", tabId
    );
  }
  catch (e) {
    result.error = toStringIfError(e);
  }
  await self.testEvents.push("ewe-test.newTabAllowlisted", [result]);
}
chrome.tabs.onUpdated.addListener(checkTabAllowlisted);

function isMV3() {
  return typeof chrome.declarativeNetRequest != "undefined";
}

let startupInfo = {};

if (isMV3()) {
  startupInfo = {
    // This object should be in sync with the data in
    // test/scripts/custom-mv3-subscriptions.json
    bundledSubscriptions: [
      {
        id: "00000000-0000-0000-0000-000000000000",
        type: "ads",
        title: "Test MV3 Custom Subscription",
        homepage: "http://localhost:3000/subscription.txt",
        url: "http://localhost:3000/subscription.txt",
        mv2_url: "http://localhost:3000/mv2_subscription.txt"
      },
      {
        id: "00000000-0000-0000-0000-000000000010",
        type: "ads",
        title: "Test MV3 Custom Subscription 2",
        homepage: "http://localhost:3000/subscription.txt?2",
        url: "http://localhost:3000/subscription.txt?2",
        mv2_url: "http://localhost:3000/mv2_subscription.txt?2"
      },
      {
        id: "00000000-0000-0000-0000-000000000020",
        type: "ads",
        title: "Test MV3 Custom Subscription 3",
        homepage: "http://localhost:3003/subscription.txt",
        url: "http://localhost:3003/subscription.txt",
        mv2_url: "http://localhost:3003/subscription.txt"
      },
      {
        id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
        type: "allowing",
        title: "Allow nonintrusive advertising",
        homepage: "https://acceptableads.com/",
        url: "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
        mv2_url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
      },
      {
        id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
        type: "ads",
        languages: [
          "en"
        ],
        title: "EasyList",
        homepage: "https://easylist.to/",
        url: "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
        mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt"
      },
      {
        id: "0CD3D105-D3B3-4652-8489-94163DE9A08F",
        type: "ads",
        languages: [
          "de"
        ],
        title: "EasyList Germany+EasyList",
        homepage: "https://easylist.to/",
        includes: [
          "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
          "4337FB2B-A95C-44D5-B78D-11AD40F7711B"
        ],
        url: "https://easylist-downloads.adblockplus.org/v3/full/easylistgermany+easylist.txt",
        mv2_url: "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"
      },
      {
        id: "D4028CDD-3D39-4624-ACC7-8140F4EC3238",
        type: "circumvention",
        title: "ABP filters",
        homepage: "https://github.com/abp-filters/abp-filters-anti-cv",
        url: "https://easylist-downloads.adblockplus.org/v3/full/abp-filters-anti-cv.txt",
        mv2_url: "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
      }
    ],
    bundledSubscriptionsPath: "subscriptions"
  };
}

EWE.start(startupInfo).then(async() => {
  if (typeof netscape != "undefined") {
    let version = /\brv:([^;)]+)/.exec(navigator.userAgent)[1];
    if (parseInt(version, 10) < 86)
      await new Promise(resolve => setTimeout(resolve, 2000));
  }

  let indexUrl = chrome.runtime.getURL("index.html");
  chrome.tabs.query({url: indexUrl}, currentTabs => {
    if (currentTabs.length == 0)
      chrome.tabs.create({url: "index.html"});
  });

  const RELOAD_FLAG = "reload-test-running";
  chrome.storage.local.get([RELOAD_FLAG], result => {
    if (result[RELOAD_FLAG])
      chrome.tabs.create({url: "reload.html"});
  });

  const UPDATE_FLAG = "update-test-running";
  chrome.storage.local.get([UPDATE_FLAG], result => {
    if (result[UPDATE_FLAG])
      chrome.tabs.create({url: "mv3-update.html"});
  });

  const MIGRATE_FLAG = "migrate-test-running";
  chrome.storage.local.get([MIGRATE_FLAG], result => {
    if (result[MIGRATE_FLAG])
      chrome.tabs.create({url: "mv2-mv3-migrate.html"});
  });
});

let injectedCode = (environment, ..._) => {
  let snippets = {"injected-snippet": arg => document.body.textContent = arg};
  for (let [name, ...args] of _)
    snippets[name](...args);
};
injectedCode.has = snippet => ["injected-snippet"].includes(snippet);

let isolatedCode = (environment, ..._) => {
  let snippets = {"isolated-snippet": arg => self.isolated_snippet_works = arg};
  for (let [name, ...args] of _)
    snippets[name](...args);
};
isolatedCode.has = snippet => ["isolated-snippet"].includes(snippet);
isolatedCode.get = () => function dependency() {
  self.isolated_snippet_dependency = true;
};

EWE.snippets.setLibrary({isolatedCode, injectedCode});

let oneClickAllowlistingPublicKeys = [
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAorAkyGHnzZkVE0TGcU7Sl6/LlH9j3udDNvHv/fSzplLMdqkw0HZNV9zaBFQ0Rw73AJ7MQ8JQm2hex9DEss3xsrlpHEi/nC7C1authg1rt5Xo4K0P5Bo+j6y41UtgQoL9xKJ6RlYGBq4uBHaq/xRyp/7zUxOiViTdnVZRhSkmyBCIQ+5l8/mTk5yyMLfH7QM0KFKdJbnnTU8HEGzHaFi33vAwWPpJjCohYUzYxgXOgSZYV6xNPycQj4U/D4k+7UT+d4zzrj7fSz08/ijfHLB8G6dr1nx7+Pydt3ijhKEX2mKaAWgKtyM2wTgFXys4rnAbdr340FpQaVebNF0bwGsqluBNdvZ6fPgN9dLlpVDQKXlOKdfOyc64Yw82/jHKdYC7NO1bg13hqo7JWM10Gklt2FY5ekfDBZagPbYCH780C8w0aMceBs3NBTI6SAPI8xhyu7LwL7vw/vMwz8kfIsKOCPFqf0qPlvJCaryIAA7Ca6SHfBqaTzyivEEqn6tWphCpYSODfPRO4Udg+l/o/PCJuly41b4QF2x8H+LvJnr7HFknmFYwisbIofC/2ucO2sfJDP4EOHKeDV9mexHSJIfjyFYV0f0ALj1eKl9Viz37qLefzXFhTG4wzoK5F/QM1ZhIWjN+0DBn6GTQxuWc4eAuASoh07JG4M+i2rWcUTYvgOECAwEAAQ==",
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAz0zHgcXEoGyk4iZHUCfrhU3j7JiHi1EhAtMONxFfmeN4bp6zOWQaMz8cU4S+2jOFD/3oKJGTYNqYH9hBXMG1GzA7nzjNBsONTE64TMxQBt8ksT0bTwqTZ4nqTRWJsjo3XPzB+qkC7a1vXmujcfRsQMY7xbBnhZ6VVGMGtpUIPXNjtjGk3JOD1rKUU8Efq2lZmQlBf63s6u6EDnX6WcdgwlLpQwewO8BrXDBurdH83ZaVrx3zOQVQyJTj0+CAkammJ04Aq1golgddz4qRzr5vmB0FQkibr3oh79HfaqByKHsqgBFeAcdSbSg/pzqeNjnH0+a6GNx31V8UoDC3cRa/Uqet+t55QTSwWI4Iu11CZrKb3HX78swDkHW9/pyG2KZeUViFLe3EqInzH7jTZPTuQR4zGXMZji/WtqWxONjt37PKReJSTnMJSh2GyVUk3tZGb1fNtgthiu711uPh8/qjiuWPiaECRnCAc6sRgblxVRD4tIYgLmbbUsTPwlBFw6iZ/2HjqowA4/S5og1M3JAp4KBr7QYRz30Ji3TUjg5rWJdzO/WNx46W1Ro08PkfidvjdQ2PJvQkCtNCgnRbyAgPLJ1hMDycsKYduKO8Y5AszVgD/RBipYg9HVkuCnYChCspu8cq6gaR1sx3IcqZZs9kZUIqAT1bxMdYkKCm0igciAkCAwEAAQ=="
];
EWE.allowlisting.setAuthorizedKeys(oneClickAllowlistingPublicKeys);

EWE.allowlisting.onUnauthorized.addListener(createTestEventListener("allowlisting.onUnauthorized"));
