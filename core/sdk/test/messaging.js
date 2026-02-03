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

import browser from "webextension-polyfill";
import expect from "expect";
import {v4 as uuidv4} from "uuid";

import {isFuzzingServiceWorker, suspendServiceWorker}
  from "./mocha/mocha-runner.js";
import {waitForAssertion} from "./utils.js";
import {limitPromiseDuration} from "./polling.js";
import {MILLIS_IN_SECOND} from "#adblockpluscore/lib/time.js";

// This is fairly arbitrary, mostly to capture calls that don't ever respond and
// hang the tests. However, 30 seconds is also the longest time we reliably have
// in MV3 for handling an event before the service worker might be suspended.
export const MAX_API_CALL_DURATION = 30 * MILLIS_IN_SECOND;

export async function fuzzSuspendServiceWorker() {
  if (isFuzzingServiceWorker()) {
    await suspendServiceWorker();
  }
}

async function waitForSendMessageResult(message) {
  let runResultPromise = browser.runtime.sendMessage(message);

  let runResult = await limitPromiseDuration(
    runResultPromise,
    `Sending the following message did not resolve: ${JSON.stringify(message, null, 2)}`,
    MAX_API_CALL_DURATION
  );

  if (!runResult) {
    console.warn(`Sending the following message did not return a result: ${JSON.stringify(message, null, 2)}`);
    runResult = {};
  }

  let {result, error} = runResult;
  if (error) {
    throw new Error(error);
  }

  return result;
}

export async function runInBackgroundPage(operations, fuzzEnabled = true) {
  if (fuzzEnabled) {
    await fuzzSuspendServiceWorker();
  }

  return waitForSendMessageResult({type: "ewe-test:run", operations});
}

function proxy(namespace) {
  return new Proxy(Object.create(null), {
    get(target, property) {
      if (property in target) {
        return target[property];
      }

      return (...args) => runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        ...namespace.map(arg => ({op: "getProp", arg})),
        ...args.map(arg => ({op: "pushArg", arg})),
        {op: "callMethod", arg: property},
        {op: "await"}
      ]);
    }
  });
}

export const EWE = Object.fromEntries([
  "account",
  "subscriptions",
  "filters",
  "notifications",
  "debugging",
  "allowlisting",
  "reporting",
  "testing",
  "cdp",
  "telemetry",
  "remoteConfig",
  "cohorts",
  "experiments",
  "sentry"
].map(name => [name, proxy([name])]));
EWE.reporting.contentTypesMap = proxy(["reporting", "contentTypesMap"]);
EWE.testing.serverLogger = proxy(["testing", "serverLogger"]);
EWE.testing.altServerLogger = proxy(["testing", "altServerLogger"]);

export async function setPremiumStatus(status) {
  await browser.runtime.sendMessage({type: "ewe-test:setPremiumResponse", status});
}

export async function resetPremiumStatus() {
  await browser.runtime.sendMessage({type: "ewe-test:resetPremiumResponse"});
}

/**
 * Adds a single filter.
 * @param {string} text - The filter text to add.
 * @param {Object} [metadata] - Metadata to associate with the filter.
 * @returns {Promise<*>}
 */
export async function addFilter(text, metadata) {
  return EWE.filters.add([text], metadata);
}

/**
 * Adds multiple filters.
 * @param {Array<string>} filters - Array of filter strings to add.
 * @param {Object} [metadata] - Metadata to associate with the filters.
 * @returns {Promise<*>}
 */
export async function addFilters(filters, metadata) {
  return EWE.filters.add(filters, metadata);
}

let activeLocks = {
  global: null,
  eventSpecific: {}
};

let data = {};
browser.runtime.onMessage.addListener(message => {
  if (message.type == "ewe-test:eventUnlock") {
    if (message.global && message.global === activeLocks.global) {
      activeLocks.global = null;
    }

    if (message.eventName &&
        message.value === activeLocks.eventSpecific[message.eventName]) {
      delete activeLocks.eventSpecific[message.eventName];
    }
  }

  if (message.type == "ewe-test:event") {
    let {eventName, eventArgs} = message;
    if (!activeLocks.global && !activeLocks.eventSpecific[eventName]) {
      if (!data[eventName]) {
        data[eventName] = [];
      }

      data[eventName].push(eventArgs);
    }
  }
});

export async function expectTestEvents(name, expectedEvents, timeout = 500) {
  await waitForAssertion(() => {
    let actualEvents = getTestEvents(name);
    expect(actualEvents).toEqual(expectedEvents);
  }, timeout);
}

/**
 * Gets the events that have been fired so far for a given event name.
 *
 * @param {string} name The name of the event to query.
 * @return {Array<Array<*>>} Outer array is each individual
 *   event. Inner array is the arguments passed to that event.
 */
export function getTestEvents(name) {
  if (data[name]) {
    return data[name];
  }

  return [];
}

export async function enableSendTestEvents(enable) {
  await browser.runtime.sendMessage({
    type: "ewe-test:enableSendEventToMochaTests",
    enable
  });
}

export async function addOnBlockableListener(name, eventOptions) {
  return await runInBackgroundPage([
    {op: "getGlobal", arg: "self"},
    {op: "pushArg", arg: name},
    {op: "pushArg", arg: eventOptions},
    {op: "callMethod", arg: "addOnBlockableEventsListener"},
    {op: "await"}
  ], false);
}

export async function removeOnBlockableListener(name) {
  return await runInBackgroundPage([
    {op: "getGlobal", arg: "self"},
    {op: "pushArg", arg: name},
    {op: "callMethod", arg: "removeOnBlockableEventsListener"},
    {op: "await"}
  ], false);
}

export async function clearTestEvents(name) {
  let lock = uuidv4();
  activeLocks.eventSpecific[name] = lock;

  delete data[name];

  await browser.runtime.sendMessage({
    type: "ewe-test:echoEventLock",
    eventName: name,
    value: lock
  });
}

export async function clearAllTestEvents() {
  let lock = uuidv4();
  activeLocks.global = lock;

  data = {};

  await browser.runtime.sendMessage({
    type: "ewe-test:echoEventLock",
    global: lock
  });
}

export async function triggerTestEvent(eventName, eventArgs) {
  await browser.runtime.sendMessage({
    type: "ewe-test:triggerTestEvent",
    eventName,
    eventArgs
  });
}

/**
 * Pings the service worker and resolves when it is done initializing.
 *
 * Some tests, like popup blocking, need to wait to see if a popup was blocked
 * or not. However, the time taken to startup and initialize is really variable,
 * especially in the fuzz tests, so it's difficult to know how long to
 * wait. With this function, we can wait for the service worker to be
 * initialized, and then check if the popup was blocked, which cuts out some of
 * the variability that the test needs to think about.
 *
 * Ideally we can in the future get to the point where startup is fast enough
 * that we don't need this. See
 * https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/307
 **/
export async function waitForServiceWorkerInitialization() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "testing"},
    {op: "callMethod", arg: "_waitForInitialization"},
    {op: "await"}
  ], false);
}

export async function getLastError() {
  return await runInBackgroundPage([{op: "getLastError"}], false);
}

export async function setFeatureFlags(featureFlags) {
  return waitForSendMessageResult({
    type: "ewe-test:setFeatureFlags",
    featureFlags
  });
}

export async function resetFeatureFlags() {
  return waitForSendMessageResult({type: "ewe-test:resetFeatureFlags"});
}
