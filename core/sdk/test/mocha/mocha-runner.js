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

import {EventEmitter} from "#adblockpluscore/lib/events.js";
import {MILLIS_IN_SECOND} from "#adblockpluscore/lib/time.js";

import browser from "webextension-polyfill";

import {increaseMinTimeout} from "../utils.js";
import {limitPromiseDuration} from "../polling.js";

let messages = [];
let emit = () => {};
let setConnected;
let connected = new Promise(resolve => {
  setConnected = resolve;
});
let webdriverEventEmitter = new EventEmitter();
let urlParams = new URLSearchParams(document.location.search);
let serviceWorkerFuzzingEnabled = urlParams.get("fuzzServiceWorkers") == "true";

function sendMessage(id, arg) {
  messages.push([id, arg]);
  emit();
}

self.poll = async function(webdriverEvents) {
  setConnected(true);

  for (let webdriverEvent of webdriverEvents) {
    webdriverEventEmitter.emit(webdriverEvent.id, webdriverEvent.arg);
  }

  if (messages.length == 0) {
    await new Promise(resolve => {
      emit = resolve;
    });
  }

  let newMessages = messages;
  messages = [];

  return newMessages;
};

let isConnectedPromise = null;
export function isConnected() {
  if (!isConnectedPromise) {
    isConnectedPromise = Promise.race([
      connected,
      new Promise(resolve => setTimeout(resolve, 10000, false))
    ]);
  }

  return isConnectedPromise;
}

async function waitForWebdriverEvent(eventName) {
  let eventReceivedPromise = new Promise(resolve => {
    function done() {
      webdriverEventEmitter.off(eventName, done);
      resolve();
    }
    webdriverEventEmitter.on(eventName, done);
  });

  const timeout = 10 * MILLIS_IN_SECOND;

  await limitPromiseDuration(
    eventReceivedPromise,
    `Did not receive a '${eventName}' event from the webdriver runner`,
    timeout
  );
}

export async function click(url, selector) {
  let target = {url, selector};
  sendMessage("click", target);
  await waitForWebdriverEvent("clicked");
}

export async function updateExtensionFiles(commands) {
  sendMessage("updateExtensionFiles", JSON.stringify(commands));
  await waitForWebdriverEvent("extensionUpdated");
}

export async function suspendServiceWorker(runnable) {
  sendMessage("suspendServiceWorker");

  if (runnable) {
    if (!await isConnected()) {
      runnable.skip();
    }

    increaseMinTimeout(runnable, 3000);
  }

  await waitForWebdriverEvent("serviceWorkerSuspended");
}

export function isFuzzingServiceWorker() {
  return serviceWorkerFuzzingEnabled;
}

export async function reloadExtension(testKey) {
  await browser.storage.local.set({[testKey]: true});
  await browser.storage.local.set({search: document.location.search});
  // Even if we await for promise above, we still need to give browser time
  // to complete setting flag, in other case in next steps we won't have
  // flag set properly and reload.html won't load
  await new Promise(r => setTimeout(r, 4500));

  sendMessage("reloadExtension");
  // From the perspective of this function, waiting for the extension to be
  // reloaded is the same as waiting for this extension page to be killed.
  await new Promise(_ => {});
}

export function start() {
  let skipped = 0;
  let runner = mocha.run();

  runner.on("end", () => {
    sendMessage("end", {failures: runner.failures, total: runner.total, skipped});
  });

  runner.on("pending", () => {
    skipped++;
  });

  Mocha.reporters.Base.useColors = true;
  Mocha.reporters.Base.consoleLog = (...args) => sendMessage("log", args);
  new Mocha.reporters.Spec(runner);
}

let originalConsole = {...console};
for (let method of ["log", "debug", "info", "warn", "error"]) {
  // eslint-disable-next-line no-console
  console[method] = function(...args) {
    originalConsole[method](...args);
    sendMessage("log", args);
  };
}

browser.runtime.onMessage.addListener(message => {
  if (message.type == "ewe-test:log") {
    // eslint-disable-next-line no-console
    console.log(`Background (${message.level}):`, ...message.args);
  }
});
