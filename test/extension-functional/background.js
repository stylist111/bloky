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

if (typeof EWE == "undefined" && typeof importScripts != "undefined") {
  importScripts("ewe-api.js", "custom-mv3-subscriptions.js");
}

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

function toPlainSubscription(subscription) {
  subscription.disabled = !subscription.enabled;
  delete subscription.enabled;
  return subscription;
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

const ENABLE_SEND_EVENT_KEY = "EWE:enable_send_event";
let enableSendEventToMochaTests = true;

async function loadEnableSendEvent() {
  if (!chrome.declarativeNetRequest || !chrome.storage.session) {
    return;
  }
  let loadedValue = await chrome.storage.session.get(ENABLE_SEND_EVENT_KEY);
  loadedValue = loadedValue[ENABLE_SEND_EVENT_KEY];
  if (typeof loadedValue != "undefined") {
    enableSendEventToMochaTests = loadedValue;
  }
}

async function setEnableSendEvent(enable) {
  enableSendEventToMochaTests = enable;

  if (!chrome.declarativeNetRequest || !chrome.storage.session) {
    return;
  }
  chrome.storage.session.set({
    [ENABLE_SEND_EVENT_KEY]: enableSendEventToMochaTests
  });
}

function sendEventToMochaTests(eventName, eventArgs) {
  if (enableSendEventToMochaTests) {
    chrome.runtime.sendMessage(
      {type: "ewe-test:event", eventName, eventArgs},
      () => {
        // this errors if there isn't a receiver (ie tests aren't
        // running). It's safe to ignore that.
        // eslint-disable-next-line no-unused-vars
        let sendErrorToIgnore = chrome.runtime.lastError;
      }
    );
  }
}

self.listeners = new Map();
function createTestEventListener(name) {
  let listener = async function(...eventArgs) {
    sendEventToMochaTests(name, eventArgs);
  };
  self.listeners.set(name, listener);
  return listener;
}

function findListener(name) {
  return self.listeners.get(name);
}

self.addOnBlockableEventsListener = function(name, arg) {
  EWE.reporting.onBlockableItem.addListener(
    createTestEventListener(name), arg);
};

self.removeOnBlockableEventsListener = function(name, arg) {
  EWE.reporting.onBlockableItem.removeListener(
    findListener(name), arg);
};

// Map(URL(string) -> Map(status(string) -> isAllowlisted(boolean)))
let isResourceAllowlisted = new Map();

async function tabsUpdatedListener(tabId, changeInfo, tab) {
  let statusToIsAllowlisted = isResourceAllowlisted.get(tab.url);
  if (!statusToIsAllowlisted) {
    statusToIsAllowlisted = new Map();
    isResourceAllowlisted.set(tab.url, statusToIsAllowlisted);
  }
  let isAllowlisted = await EWE.filters.isResourceAllowlisted(tab.url,
                                                              "document", tabId);
  statusToIsAllowlisted.set(changeInfo.status, isAllowlisted);
}

const FEATURE_FLAGS_KEY = "ewe-test:featureFlags";

async function restoreFeatureFlags() {
  // This is required for maintaining the feature flags set by tests when the
  // MV3 service worker restarts. The feature flags don't need any persistence
  // in normal use, because their values should be hard coded into the extension
  // and passed into EWE.start.
  if (chrome.storage.session) {
    let loadResults = await chrome.storage.session.get(FEATURE_FLAGS_KEY);
    if (loadResults && loadResults[FEATURE_FLAGS_KEY]) {
      EWE.testing._setFeatureFlags(loadResults[FEATURE_FLAGS_KEY]);
    }
  }
}

async function setFeatureFlags(featureFlags) {
  if (chrome.storage.session) {
    await chrome.storage.session.set({
      [FEATURE_FLAGS_KEY]: featureFlags
    });
  }

  await EWE.testing._setFeatureFlags(featureFlags);
}

async function resetFeatureFlags() {
  if (chrome.storage.session) {
    await chrome.storage.session.remove(FEATURE_FLAGS_KEY);
  }

  return EWE.testing._resetFeatureFlags();
}

let messages = [];
let migrationErrorsOnStart;

function handleTestMessage(request, sender, sendResponse) {
  if (typeof request != "object" || request == null || !request.type ||
  !(request.type.startsWith("ewe-test:") || request.type.startsWith("ewe:") ||
  request.type.startsWith("filters") || request.type.startsWith("subscriptions") ||
  request.type.startsWith("debug"))
  ) {
    return false;
  }

  messages.push({request, sender});
  switch (request.type) {
    case "ewe-test:run":
      runOperations(request.operations).then(
        res => sendResponse({result: toStringIfError(res)}),
        err => sendResponse({error: toStringIfError(err)})
      );
      return true;

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

    case "ewe-test:getMigrationErrorsOnStart": {
      sendResponse(migrationErrorsOnStart);
      return true;
    }

    case "ewe-test:getState": {
      sendResponse(state);
      return true;
    }

    case "ewe-test:setFeatureFlags": {
      setFeatureFlags(request.featureFlags).then(
        res => sendResponse({result: toStringIfError(res)}),
        err => sendResponse({error: toStringIfError(err)})
      );
      return true;
    }

    case "ewe-test:resetFeatureFlags": {
      resetFeatureFlags().then(
        res => sendResponse({result: toStringIfError(res)}),
        err => sendResponse({error: toStringIfError(err)})
      );
      return true;
    }

    case "ewe-test:error": {
      Promise.reject("test error");
      sendResponse({result: {}});
      return true;
    }

    // Required for testing testpages
    case "filters.get": {
      EWE.filters.getUserFilters().then(userFilters => {
        sendResponse(userFilters);
      });
      return true;
    }

    case "filters.importRaw": {
      let lines = request.text.split("\n");
      EWE.filters.add(lines).finally(() => sendResponse({}));
      return true;
    }

    case "filters.remove": {
      EWE.filters.remove(request.text).finally(() => sendResponse({}));
      return true;
    }

    case "subscriptions.get": {
      let subscriptions = [];
      EWE.subscriptions.getSubscriptions().then(subs => {
        for (let s of subs) {
          if (request.ignoreDisabled && !s.enabled) {
            continue;
          }

          let subscription = toPlainSubscription(s);
          if (request.disabledFilters) {
            let filters = EWE.subscriptions.getFilters(s.url);
            subscription.disabledFilters = filters.filter(f =>
              f.enabled === false).map(f => f.text);
          }
          subscriptions.push(subscription);
        }
        sendResponse(subscriptions);
      });
      return true;
    }

    case "subscriptions.remove": {
      EWE.subscriptions.remove(request.url).finally(() => sendResponse({}));
      return true;
    }

    case "debug.getLastError": {
      let error = lastError;
      lastError = null;
      sendResponse(error);
      return true;
    }

    case "ewe-test:subscribeTabsOnUpdated": {
      chrome.tabs.onUpdated.addListener(tabsUpdatedListener);
      sendResponse({});
      return true;
    }

    case "ewe-test:unsubscribeTabsOnUpdated": {
      chrome.tabs.onUpdated.removeListener(tabsUpdatedListener);
      sendResponse({});
      return true;
    }

    case "ewe-test:isResourceAllowlisted": {
      let statusToIsAllowlisted = isResourceAllowlisted.get(request.url) ||
         new Map();
      sendResponse(statusToIsAllowlisted.get(request.status));
      return true;
    }

    case "ewe-test:enableSendEventToMochaTests": {
      setEnableSendEvent(request.enable);

      // eslint-disable-next-line no-console
      let log = (enableSendEventToMochaTests ? console.log : console.warn);
      log((enableSendEventToMochaTests ? "Enabling" : "Disabling") +
        " sending events to mocha tests");
      sendResponse({});
      return true;
    }

    case "ewe-test:initSnippets": {
      initSnippets();
      sendResponse({});
      return true;
    }

    case "ewe-test:deinitSnippets": {
      deinitSnippets();
      sendResponse({});
      return true;
    }
  }
  return true;
}
chrome.runtime.onMessage.addListener(handleTestMessage);

addEventListener("error", ({error}) => {
  lastError = typeof error == "object" ? error.message : error;
});

addEventListener("unhandledrejection", ({reason}) => {
  lastError = typeof reason == "object" ? reason.message : reason;
});

EWE.filters.onAdded.addListener(createTestEventListener("filters.onAdded"));
EWE.filters.onChanged.addListener(createTestEventListener("filters.onChanged"));
EWE.filters.onRemoved.addListener(createTestEventListener("filters.onRemoved"));
EWE.filters.onExpired.addListener(createTestEventListener("filters.onExpired"));
EWE.filters.onRenewed.addListener(createTestEventListener("filters.onRenewed"));
EWE.subscriptions.onAdded.addListener(createTestEventListener("subscriptions.onAdded"));
EWE.subscriptions.onChanged.addListener(createTestEventListener("subscriptions.onChanged"));
EWE.subscriptions.onRemoved.addListener(createTestEventListener("subscriptions.onRemoved"));
EWE.reporting.onSubscribeLinkClicked.addListener(createTestEventListener("reporting.onSubscribeLinkClicked"));
EWE.notifications.addShowListener(createTestEventListener("notifications.addShowListener"));
EWE.notifications.addShowListener(async notification => {
  await EWE.notifications.markAsShown(notification.id);
});
EWE.telemetry.onError.addListener(createTestEventListener("telemetry.onError"));

EWE.reporting.onBlockableItem.addListener(
  createTestEventListener("reporting.onBlockableItem.defaultEventOptions"),
  {}
);
EWE.reporting.onBlockableItem.addListener(
  createTestEventListener("reporting.onBlockableItem.allowingEventOptions"),
  {filterType: "allowing"}
);
EWE.reporting.onBlockableItem.addListener(
  createTestEventListener("reporting.onBlockableItem.elemhideEventOptions"),
  {includeElementHiding: true}
);
EWE.reporting.onBlockableItem.addListener(
  createTestEventListener("reporting.onBlockableItem.unmatchedEventOptions"),
  {includeUnmatched: true, filterType: "all"}
);
EWE.reporting.onBlockableItem.addListener(
  createTestEventListener("reporting.onBlockableItem.allEventOptions"),
  {
    includeElementHiding: true,
    includeUnmatched: true,
    filterType: "all"
  }
);

EWE.cdp.onCdpItem.addListener(
  createTestEventListener("cdp.onCdpItem.all")
);
EWE.cdp.onCdpItem.addListener(
  createTestEventListener("cdp.onCdpItem.page_view"),
  {
    eventType: "page_view"
  }
);
EWE.cdp.onCdpItem.addListener(
  createTestEventListener("cdp.onCdpItem.session_start"),
  {
    eventType: "session_start"
  }
);
EWE.cdp.onCdpItem.addListener(
  createTestEventListener("cdp.onCdpItem.blocking"),
  {
    eventType: "blocking"
  }
);

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
  sendEventToMochaTests("ewe-test.newTabAllowlisted", [result]);
}
chrome.tabs.onUpdated.addListener(checkTabAllowlisted);

function isMV3() {
  return typeof chrome.declarativeNetRequest != "undefined";
}

let startupInfo = {};

if (isMV3()) {
  startupInfo.bundledSubscriptionsPath = "subscriptions";
  // `customMV3Subscriptions` is bundled as a json object by
  // scripts/prepare-mv3-files.js
  // eslint-disable-next-line no-undef
  startupInfo.bundledSubscriptions = customMV3Subscriptions.filter(
    // The update tests need this subscription to be removed
    sub => sub.id != "00000000-0000-0000-0000-000000000092");
}

startupInfo.telemetry = {
  url: "http://localhost:3003/telemetry",
  bearer: "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg=="
};

startupInfo.cdp = {
  pingUrl: "http://localhost:3003/cdp-ping",
  aggregateUrl: "http://localhost:3003/cdp-aggregate",
  publicKeyUrl: "http://localhost:3003/public-key",
  bearer: "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg=="
};

// This line is here to be overridden in the update tests, which tests that when
// we pass a different value here it's actually set. Generally, our test
// extension should use our SDK's default features when running tests unless the
// specific test changes the value, so this should be left empty.
startupInfo.featureFlags = {};

let state = "starting";

EWE.start(startupInfo).then(async firstRun => {
  state = "started";
  await loadEnableSendEvent();

  EWE.testing.enableDebugOutput(true);
  if (firstRun.warnings.length > 0) {
    console.warn("EWE startup warnings: ", firstRun.warnings);
  }

  migrationErrorsOnStart = await EWE.subscriptions.getMigrationErrors();

  if (typeof netscape != "undefined") {
    let version = /\brv:([^;)]+)/.exec(navigator.userAgent)[1];
    if (parseInt(version, 10) < 86) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  let indexUrl = chrome.runtime.getURL("index.html");
  chrome.tabs.query({url: indexUrl}, currentTabs => {
    if (currentTabs.length == 0) {
      chrome.tabs.create({url: "index.html"});
    }
  });

  for (let testKind of ["reload", "update", "mv2-mv3-migrate"]) {
    const TEST_FLAG = `${testKind}-test-running`;
    chrome.storage.local.get([TEST_FLAG], result => {
      if (result[TEST_FLAG]) {
        chrome.storage.local.get(["search"], searchResult => {
          chrome.tabs.create({url: `${testKind}.html${searchResult.search.replace("start=1&", "")}`});
        });
      }
    });
  }
});

restoreFeatureFlags();

let injectedCode = (environment, ..._) => {
  function loadContext() {
    let context = {};
    try {
      context = JSON.parse(document.body.id);
    }
    catch (e) {
      // may not exist yet
    }
    return context;
  }
  function saveContext(context) {
    document.body.id = JSON.stringify(context);
  }
  function incrementCounter(context) {
    context.counter = (context.counter || 0) + 1;
  }
  let injectedSnippetBody = arg => {
    let context = loadContext();
    context.arg = arg;
    incrementCounter(context);
    saveContext(context);
  };
  let recurringSnippetBody = () => {
    let context = loadContext();
    context.recurring_history = [];
    incrementCounter(context);
    // stays unchanged over the calls as it's local variable
    let counter = context.counter;
    saveContext(context);
    function pushAndReschedule() {
      let currentContext = loadContext();
      currentContext.recurring_history.push(counter);
      saveContext(currentContext);
      setTimeout(pushAndReschedule, 100);
    }
    pushAndReschedule();
  };
  let snippets = {
    "injected-snippet": injectedSnippetBody,
    "hide-if-classifies": injectedSnippetBody,
    "recurring-injected-snippet": recurringSnippetBody
  };
  for (let [name, ...args] of _) {
    snippets[name](...args);
  }
};
injectedCode.has = snippet => [
  "injected-snippet",
  "hide-if-classifies",
  "recurring-injected-snippet"
].includes(snippet);

let isolatedCode = (environment, ..._) => {
  let snippets = {"isolated-snippet": arg => self.isolated_snippet_works = arg};
  for (let [name, ...args] of _) {
    snippets[name](...args);
  }
};
isolatedCode.has = snippet => ["isolated-snippet"].includes(snippet);
isolatedCode.get = () => function dependency() {
  self.isolated_snippet_dependency = true;
};

function initSnippets() {
  EWE.snippets.setLibrary({isolatedCode, injectedCode});
}

function deinitSnippets() {
  EWE.snippets.setLibrary({isolatedCode: null, injectedCode: null});
}

initSnippets();

let oneClickAllowlistingPublicKeys = [
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAorAkyGHnzZkVE0TGcU7Sl6/LlH9j3udDNvHv/fSzplLMdqkw0HZNV9zaBFQ0Rw73AJ7MQ8JQm2hex9DEss3xsrlpHEi/nC7C1authg1rt5Xo4K0P5Bo+j6y41UtgQoL9xKJ6RlYGBq4uBHaq/xRyp/7zUxOiViTdnVZRhSkmyBCIQ+5l8/mTk5yyMLfH7QM0KFKdJbnnTU8HEGzHaFi33vAwWPpJjCohYUzYxgXOgSZYV6xNPycQj4U/D4k+7UT+d4zzrj7fSz08/ijfHLB8G6dr1nx7+Pydt3ijhKEX2mKaAWgKtyM2wTgFXys4rnAbdr340FpQaVebNF0bwGsqluBNdvZ6fPgN9dLlpVDQKXlOKdfOyc64Yw82/jHKdYC7NO1bg13hqo7JWM10Gklt2FY5ekfDBZagPbYCH780C8w0aMceBs3NBTI6SAPI8xhyu7LwL7vw/vMwz8kfIsKOCPFqf0qPlvJCaryIAA7Ca6SHfBqaTzyivEEqn6tWphCpYSODfPRO4Udg+l/o/PCJuly41b4QF2x8H+LvJnr7HFknmFYwisbIofC/2ucO2sfJDP4EOHKeDV9mexHSJIfjyFYV0f0ALj1eKl9Viz37qLefzXFhTG4wzoK5F/QM1ZhIWjN+0DBn6GTQxuWc4eAuASoh07JG4M+i2rWcUTYvgOECAwEAAQ==",
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAz0zHgcXEoGyk4iZHUCfrhU3j7JiHi1EhAtMONxFfmeN4bp6zOWQaMz8cU4S+2jOFD/3oKJGTYNqYH9hBXMG1GzA7nzjNBsONTE64TMxQBt8ksT0bTwqTZ4nqTRWJsjo3XPzB+qkC7a1vXmujcfRsQMY7xbBnhZ6VVGMGtpUIPXNjtjGk3JOD1rKUU8Efq2lZmQlBf63s6u6EDnX6WcdgwlLpQwewO8BrXDBurdH83ZaVrx3zOQVQyJTj0+CAkammJ04Aq1golgddz4qRzr5vmB0FQkibr3oh79HfaqByKHsqgBFeAcdSbSg/pzqeNjnH0+a6GNx31V8UoDC3cRa/Uqet+t55QTSwWI4Iu11CZrKb3HX78swDkHW9/pyG2KZeUViFLe3EqInzH7jTZPTuQR4zGXMZji/WtqWxONjt37PKReJSTnMJSh2GyVUk3tZGb1fNtgthiu711uPh8/qjiuWPiaECRnCAc6sRgblxVRD4tIYgLmbbUsTPwlBFw6iZ/2HjqowA4/S5og1M3JAp4KBr7QYRz30Ji3TUjg5rWJdzO/WNx46W1Ro08PkfidvjdQ2PJvQkCtNCgnRbyAgPLJ1hMDycsKYduKO8Y5AszVgD/RBipYg9HVkuCnYChCspu8cq6gaR1sx3IcqZZs9kZUIqAT1bxMdYkKCm0igciAkCAwEAAQ=="
];
EWE.allowlisting.setAuthorizedKeys(oneClickAllowlistingPublicKeys);
EWE.allowlisting.onUnauthorized.addListener(createTestEventListener("allowlisting.onUnauthorized"));

let originalConsole = {...console};
for (let method of ["log", "debug", "info", "warn", "error"]) {
  // eslint-disable-next-line no-console
  console[method] = function(...args) {
    originalConsole[method](...args);
    chrome.runtime.sendMessage(
      {type: "ewe-test:log", level: method, args},
      () => {
        // this errors if there isn't a receiver (ie tests aren't
        // running). It's safe to ignore that.
        // eslint-disable-next-line no-unused-vars
        let sendErrorToIgnore = chrome.runtime.lastError;
      }
    );
  };
}
