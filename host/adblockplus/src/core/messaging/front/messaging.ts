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

import {
  type ConnectListener,
  type DisconnectListener,
  type BackgroundMessageListener
} from "../background";
import {
  type Message,
  MessageEmitter,
  getMessageResponse,
  isMessage
} from "../shared";
import {
  type FrontMessageEmitter,
  type ListenOptions,
  type Port
} from "./messaging.types";

/**
 * The browser.runtime port.
 */
let port: Port;

/**
 * A set of connection listeners
 */
const connectListeners = new Set<ConnectListener>();

/**
 * A set of disconnection listeners
 */
const disconnectListeners = new Set<DisconnectListener>();

/**
 * A set of message listeners
 */
const messageListeners = new Set<BackgroundMessageListener>();

/**
 * Message emitter for use in front context
 */
export const messageEmitter: FrontMessageEmitter = new MessageEmitter();

/**
 * Adds a connect listener to the appropriate set.
 *
 * This also fires the listener as at the point on adding it we have already connected
 *
 * @param listener supplied callback to be fired on connect
 */
export function addConnectListener(listener: ConnectListener): void {
  connectListeners.add(listener);
  listener();
}

/**
 * Adds a disconnect listener to the appropriate set
 *
 * @param listener supplied callback to be fired on disconnectconnect
 */
export function addDisconnectListener(listener: DisconnectListener): void {
  disconnectListeners.add(listener);
}

/**
 * Adds a message listener to the appropriate set
 *
 * @param listener supplied callback to be fired on recieving a message
 */
export function addMessageListener(listener: BackgroundMessageListener): void {
  messageListeners.add(listener);
}

/**
 * Connects the port and sets message and disconnect listeners
 */
const connect = (): Port | null => {
  // We're only establishing one connection per page, for which we need to
  // ignoresubsequent connection attempts
  if (port) {
    return port;
  }

  try {
    port = browser.runtime.connect({ name: "ui" });
  } catch (ex) {
    // We are no longer able to connect to the background page, so we give up
    // and assume that the extension is gone
    port = null;

    disconnectListeners.forEach((listener) => {
      listener();
    });

    return port;
  }

  port.onMessage.addListener((message: unknown) => {
    if (!isMessage(message)) {
      return;
    }

    onMessage(message);
  });

  port.onDisconnect.addListener(onDisconnect);

  connectListeners.forEach((listener) => {
    listener();
  });

  return port;
};

/**
 * Determines whether code is running as a content script
 */
function isContentScript(): boolean {
  // By checking whether the protocols of the current URL and the extension's
  // root URL are the same, we can determine whether the script is running in
  // the context of a web page (i.e. content script) or in the context of the
  // extension (i.e. background process, UI page, testing environment)
  const extensionUrl = new URL(browser.runtime.getURL("/"));
  return location.protocol !== extensionUrl.protocol;
}

/**
 * Adds connect listeners of a supplied type
 *
 * @param props.type the type of listen event. dictates how the port will respond
 * @param props.filter Filter strings to be acted upon.
 * @param ...options Other properties that may be passed, depending on type
 */
export function listen({ type, filter, ...options }: ListenOptions): void {
  addConnectListener(() => {
    if (port) {
      port.postMessage({
        type: `${type}.listen`,
        filter,
        ...options
      });
    }
  });
}

/**
 * When the connection to the background page drops, we try to reconnect,
 * assuming that the extension is still there, in order to wake up the
 * service worker
 */
function onDisconnect(): void {
  port = null;
  // If the disconnect occurs due to the extension being unloaded, we may
  // still be able to reconnect while that's ongoing, which misleads us into
  // thinking that the extension is still there. Therefore we need to wait
  // a little bit before trying to reconnect.
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1312478
  setTimeout(() => connect(), 100);
}

/**
 * When the port receives a message, if the type end in .respond,
 * all message listeners are fired
 *
 * @param message props including type, passed on to the message listeners
 */
function onMessage(message: Message): void {
  if (!message.type.endsWith(".respond")) {
    return;
  }

  messageListeners.forEach((listener) => {
    listener(message);
  });
}

/**
 * Stops a disconnect listener from firing listening
 *
 * @param listener disconnect listener to remove
 */
export function removeDisconnectListener(listener: DisconnectListener): void {
  disconnectListeners.delete(listener);
}

/**
 * Initializes front messaging API
 */
function start(): void {
  // Since we're not listening to any events from content scripts, we don't
  // connect from those in order to avoid problems related to bfcache
  // https://developer.chrome.com/blog/bfcache-extension-messaging-changes
  // https://eyeo.atlassian.net/browse/OM-808
  if (!isContentScript()) {
    // Establish connection to background page to receive events
    connect();
  }

  // Firefox 55 erroneously sends messages from the content script to the
  // devtools panel:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1383310
  // As a workaround, listen for messages only if this isn't the devtools panel.
  // Note that Firefox processes API access lazily, so browser.devtools will
  // always exist but will have undefined as its value on other pages.
  if (typeof browser.devtools === "undefined") {
    // Listen for messages from the background page.
    // We're disabling the requirement for always returning a promise, because we
    // need to be careful what we return from this listener function. It may be
    // harmful for us to return a truthy value (e.g. a Promise), since the browser
    // may misinterpret it as being an actual value, causing unexpected behavior.
    /* eslint-disable-next-line @typescript-eslint/promise-function-async */
    browser.runtime.onMessage.addListener((message: unknown, sender) => {
      if (!isMessage(message)) {
        return;
      }

      const responses = messageEmitter.dispatch(message, sender);
      const response = getMessageResponse(responses);
      if (typeof response === "undefined") {
        return;
      }

      return Promise.resolve(response);
    });
  }
}

// There are numerous bundles in which the messaging API is being used, and
// there's no bootstrapping mechanism them that we could easily hook into for
// them. Therefore we're initializing the module automatically for now.
start();
