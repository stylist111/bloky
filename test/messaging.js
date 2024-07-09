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

import {isFuzzingServiceWorker, suspendServiceWorker}
  from "./mocha/mocha-runner.js";
import {waitForAssertion} from "./utils.js";
import {limitPromiseDuration} from "./polling.js";
import {MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

// This is fairly arbitrary, mostly to capture calls that don't ever respond and
// hang the tests. However, 30 seconds is also the longest time we reliably have
// in MV3 for handling an event before the service worker might be suspended.
const MAX_API_CALL_DURATION = 30 * MILLIS_IN_SECOND;

export async function fuzzSuspendServiceWorker() {
  if (isFuzzingServiceWorker()) {
    await suspendServiceWorker();
  }
}

export async function runInBackgroundPage(operations, fuzzEnabled = true) {
  if (fuzzEnabled) {
    await fuzzSuspendServiceWorker();
  }

  let runResultPromise =
      browser.runtime.sendMessage({type: "ewe-test:run", operations});

  let runResult = await limitPromiseDuration(
    runResultPromise,
    `Calling ewe-test:run with these operations did not resolve: ${JSON.stringify(operations)}`,
    MAX_API_CALL_DURATION);

  if (!runResult) {
    console.warn("Call to ewe-test:run with these arguments didn't return a result",
                 operations);
    runResult = {};
  }

  let {result, error} = runResult;
  if (error) {
    throw new Error(error);
  }

  return result;
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
  "subscriptions",
  "filters",
  "notifications",
  "debugging",
  "allowlisting",
  "reporting",
  "testing",
  "cdp",
  "telemetry"
].map(name => [name, proxy([name])]));
EWE.reporting.contentTypesMap = proxy(["reporting", "contentTypesMap"]);

export async function addFilter(text, metadata) {
  let result = await EWE.filters.add([text], metadata);
  return result;
}

let data = {};
browser.runtime.onMessage.addListener(message => {
  if (message.type == "ewe-test:event") {
    let {eventName, eventArgs} = message;
    if (!data[eventName]) {
      data[eventName] = [];
    }

    data[eventName].push(eventArgs);
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

export function clearTestEvents(name) {
  delete data[name];
}

export function clearAllTestEvents() {
  data = {};
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
  let {result, error} = await browser.runtime.sendMessage({
    type: "ewe-test:setFeatureFlags",
    featureFlags
  });

  if (error) {
    throw new Error(error);
  }

  return result;
}

export async function resetFeatureFlags() {
  let {result, error} = await browser.runtime.sendMessage({
    type: "ewe-test:resetFeatureFlags"
  });

  if (error) {
    throw new Error(error);
  }

  return result;
}
