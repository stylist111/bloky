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

import {fuzzSuspendServiceWorker} from "./mocha/mocha-runner.js";

export async function runInBackgroundPage(operations, fuzzEnabled = true) {
  if (fuzzEnabled)
    await fuzzSuspendServiceWorker();

  let {result, error} =
    await browser.runtime.sendMessage({type: "ewe-test:run", operations});
  if (error)
    throw new Error(error);

  return result;
}

export async function makeCallbackInBackgroundPage(callback) {
  await fuzzSuspendServiceWorker();
  let id = await browser.runtime.sendMessage({type: "ewe-test:make-callback"});

  browser.runtime.onMessage.addListener(message => {
    if (message.type == "ewe-test:call-callback" && message.id == id)
      callback(...message.args);
    return true;
  });

  return id;
}

function proxy(namespace) {
  return new Proxy(Object.create(null), {
    get(target, property) {
      if (property in target)
        return target[property];

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
  "testing"
].map(name => [name, proxy([name])]));
EWE.reporting.contentTypesMap = proxy(["reporting", "contentTypesMap"]);

export function addFilter(text) {
  return EWE.filters.add([text]);
}

export async function ensureEverythingHasSaved() {
  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "debugging"},
    {op: "callMethod", arg: "ensureEverythingHasSaved"},
    {op: "await"}
  ], false);
}

/**
 * Gets the events that have been fired so far for a given event name.
 *
 * @param {string} name The name of the event to query.
 * @return {Array<Array<*>>} Outer array is each individual
 *   event. Inner array is the arguments passed to that event.
 */
export async function getTestEvents(name) {
  return await runInBackgroundPage([
    {op: "getGlobal", arg: "self"},
    {op: "pushArg", arg: name},
    {op: "callMethod", arg: "getTestEvents"},
    {op: "await"}
  ], false);
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
  return await runInBackgroundPage([
    {op: "getGlobal", arg: "testEvents"},
    {op: "pushArg", arg: name},
    {op: "callMethod", arg: "clear"},
    {op: "await"}
  ], false);
}

export async function clearAllTestEvents() {
  return await runInBackgroundPage([
    {op: "getGlobal", arg: "testEvents"},
    {op: "callMethod", arg: "clearAll"},
    {op: "await"}
  ], false);
}
