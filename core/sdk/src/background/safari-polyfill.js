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

/* eslint-disable no-console */

import browser from "webextension-polyfill";
import {log} from "./safari-logs.js";

// Using `console` as `debugging` module might not be yet initialized.

let historyApiPrototype = {
  __listeners: new Map(),
  addListener(listener, filter) {
    if (this.hasListener(listener)) {
      return;
    }
    this.__listeners.set(listener, filter);
  },
  removeListener(listener) {
    this.__listeners.delete(listener);
  },
  hasListener(listener) {
    return this.__listeners.has(listener);
  }
};

let safariOnHistoryStateUpdated = Object.create(historyApiPrototype);

async function waitForWebNavigation() {
  return new Promise(r => {
    function checkWebNavigation() {
      if (typeof browser.webNavigation != "undefined") {
        log("Got webNavigation!");
        log(browser.webNavigation);
        log(typeof browser.webNavigation);
        r();
        return;
      }
      log("Rescheduling for webNavigation..");
      console.log("Rescheduling for webNavigation..");
      setTimeout(checkWebNavigation, 10);
    }
    checkWebNavigation();
  });
}

export async function patchForSafari(doWaitForWebNavigation = true) {
  log("patchForSafari() patching for safari ...");
  try {
    // Polyfill browser.webRequest namespace on Safari < iOS 18
    if (!browser.webRequest) {
      console.warn("Polyfilling missing browser.webRequest namespace");
      browser.webRequest = {};
    }
    // Polyfill the missing ResourceType enum if it is not already defined.
    if (!browser.webRequest.ResourceType) {
      console.debug("Polyfilling webRequest.ResourceType");
      browser.webRequest.ResourceType = {
        CSP_REPORT: "csp_report",
        FONT: "font",
        IMAGE: "image",
        MAIN_FRAME: "main_frame",
        MEDIA: "media",
        OBJECT: "object",
        OTHER: "other",
        PING: "ping",
        SCRIPT: "script",
        STYLESHEET: "stylesheet",
        SUB_FRAME: "sub_frame",
        // WEBBUNDLE: "webbundle", // not supported by Safari
        WEBSOCKET: "websocket",
        XMLHTTPREQUEST: "xmlhttprequest"
      };
    }
    // Polyfill common webRequest events as no-ops
    [
      "onBeforeRequest",
      "onBeforeSendHeaders",
      "onHeadersReceived",
      "onResponseStarted",
      "onBeforeRedirect",
      "onCompleted",
      "onErrorOccurred"
    ].forEach(eventName => {
      if (!browser.webRequest[eventName]) {
        browser.webRequest[eventName] = {
          addListener() {
            console.warn(`Stub ${eventName}.addListener called`);
          },
          removeListener() {},
          hasListener() {
            return false;
          }
        };
      }
    });

    if (!browser.runtime.OnInstalledReason) {
      console.debug("Patching runtime.OnInstalledReason");
      browser.runtime.OnInstalledReason = {
        // Other enum values are not used in the SDK at the moment
        UPDATE: "update"
      };
    }

    if (!browser.webNavigation.onCreatedNavigationTarget) {
      console.debug("Patching webNavigation.onCreatedNavigationTarget");
      browser.webNavigation.onCreatedNavigationTarget = {
        addListener() {
          // not implemented
          console.warn("Stub webNavigation.addListener() called");
        }
      };
    }

    // browser.declarativeNetRequest is only available under Manifest v3,
    // so we shouldn't polyfill it, in case we're running under Manifest v2
    if (browser.declarativeNetRequest) {
      if (!browser.declarativeNetRequest.getSessionRules) {
        console.debug("Patching declarativeNetRequest.getSessionRules");
        browser.declarativeNetRequest.getSessionRules = async function() {
          // not implemented
          console.warn("Stub declarativeNetRequest.getSessionRules() called");
          return [];
        };
      }

      if (!browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES) {
        console.debug("Patching declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES");
        browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 5000;
      }
    }

    // browser.scripting is only available under Manifest v3,
    // so we shouldn't polyfill it, in case we're running under Manifest v2
    if (browser.scripting) {
      if (!browser.scripting.ExecutionWorld) {
        console.debug("Patching scripting.ExecutionWorld");
        browser.scripting.ExecutionWorld = {
          ISOLATED: "ISOLATED",
          MAIN: "MAIN"
        };
      }
    }

    if (doWaitForWebNavigation) {
      console.log("webNavigation", browser.webNavigation);
      log("webNavigation before await:");
      log(browser.webNavigation);
      await waitForWebNavigation();
      log("webNavigation after await:");
      log(browser.webNavigation);
      if (!browser.webNavigation.onHistoryStateUpdated) {
        console.debug("Patching onHistoryStateUpdated");
        browser.webNavigation.onHistoryStateUpdated =
          safariOnHistoryStateUpdated;
      }
      browser.webNavigation.patchedForOnHistoryStateUpdated = true;
      log("webNavigation after possible patching:");
      log(browser.webNavigation);
    }
  }
  catch (e) {
    console.error("Failed to polyfill for Safari:", e);
  }
}

export function onHistoryStateUpdatedSafari(
  tabId, frameId, event) {
  console.debug("onSafariHistoryStateUpdated()", tabId, frameId, JSON.stringify(event));
  log("onHistoryStateUpdated called");

  if (!safariOnHistoryStateUpdated.__listeners) {
    console.warn("Listener is not patched for Safari");
    return;
  }

  let details = {
    tabId, frameId, ...event
  };

  // eslint-disable-next-line no-unused-vars
  for (let [listener, filter] of
    safariOnHistoryStateUpdated.__listeners) {
    // Warning: `filter` is ignored as we don't need it for SDK working
    listener(details);
  }
}

// Safari provides limited web extension API support,
// "webextension-polyfill" does not support Safari.
// We have to do patching right now as the following "ewe-api.js" code
// already assumes `browser.webRequest.ResourceType` to be in place.
patchForSafari(false);
