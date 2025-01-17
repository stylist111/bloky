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

import browser from "./browser.js";
import {isRunningInServiceWorker} from "./browser-features.js";
import {ignoreNoConnectionError} from "../all/errors.js";
import {trace, debug, warn} from "./debugging.js";
import {PersistentState} from "./persistence.js";

// It keeps lists of deferred messages after frame loading is started
// until "ewe:content-hello" message from the injected content script is
// received. Then the messages are sent and the according maps are removed.
// Object<tabId, Object<frameId,[message]>>
let deferredMessages = new PersistentState("ewe:deferred-content-messages");
let startupPromise;

// for testing purposes
export function _getDeferredMessages() {
  return deferredMessages;
}

export function getDeferredMessages(tabId, frameId) {
  const frameIdToMessages = deferredMessages.getState()[tabId];
  if (!frameIdToMessages) {
    return null;
  }

  return frameIdToMessages[frameId];
}

async function sendMessage(tabId, frameId, message) {
  const doSendMessage = () => {
    trace({tabId, frameId, message});
    return browser.tabs.sendMessage(tabId, message, {frameId});
  };

  // Retrying to fix a connection error on Chromium 90 and on Firefox
  await doSendMessage().catch(async e => {
    warn(`Failed to send the message: ${e.message}, retrying`);
    await ignoreNoConnectionError(doSendMessage());
  });
}

export async function sendContentMessage(tabId, frameId, message) {
  trace({tabId, frameId, message});

  let messages = getDeferredMessages(tabId, frameId);
  if (messages) {
    // content script is not ready yet, deferring
    messages.push(message);
    debug(() => "Deferred the message: " + JSON.stringify(message));
    _saveDeferredMessages();
  }
  else {
    await sendMessage(tabId, frameId, message);
  }
}

function cleanDeferredMessages(tabId, frameId) {
  trace({tabId, frameId});

  let frameIdToMessages = deferredMessages.getState()[tabId];
  if (!frameIdToMessages) {
    return;
  }

  delete frameIdToMessages[frameId];
  if (Object.keys(frameIdToMessages).length == 0) {
    delete deferredMessages.getState()[tabId];
  }

  _saveDeferredMessages();
}

export async function onContentHelloReceived(tabId, frameId) {
  trace({tabId, frameId});

  const messages = getDeferredMessages(tabId, frameId);
  if (!messages) {
    return;
  }

  cleanDeferredMessages(tabId, frameId);
  for (const message of messages) {
    await sendMessage(tabId, frameId, message);
  }

  _saveDeferredMessages();
}

function initialize(tabId, frameId) {
  let frameIdToMessages = deferredMessages.getState()[tabId];
  if (!frameIdToMessages) {
    frameIdToMessages = {};
    deferredMessages.getState()[tabId] = frameIdToMessages;
  }

  let messages = frameIdToMessages[frameId];
  if (!messages) {
    messages = [];
    frameIdToMessages[frameId] = messages;
  }
}

function onBeforeNavigate(details) {
  trace({details});
  initialize(details.tabId, details.frameId);
}

function onRemoved(tabId) {
  trace({tabId});

  delete deferredMessages.getState()[tabId];
  _saveDeferredMessages();
}

export async function _loadDeferredMessages() {
  await deferredMessages.load();
}

export function _doSaveDeferredMessages() {
  deferredMessages.save();
}

export function _saveDeferredMessages() {
  if (!isRunningInServiceWorker()) {
    return;
  }

  _doSaveDeferredMessages();
}

export async function _awaitSavingComplete() {
  await deferredMessages.awaitSavingComplete();
}

/**
 * Start the message deferrer module. In MV3, this must be called in
 * the first turn of the event loop.
 */
export async function start() {
  if (!startupPromise) {
    browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    browser.tabs.onRemoved.addListener(onRemoved);

    startupPromise = (isRunningInServiceWorker() ?
      _loadDeferredMessages() : Promise.resolve(null));
  }

  await startupPromise;
}
