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

//
// safari-polyfill.js
//
// This file provides SDK-specific Safari functionality that requires
// ES module exports. Basic polyfills are in safari-polyfill-early.js
// which is injected at bundle start via webpack BannerPlugin.
//
// This file handles:
// - History state change listener shim (onHistoryStateUpdated)
// - waitForWebNavigation async helper
// - Ensuring globalThis.browser is set
//

/* eslint-disable no-console */

import browser from "webextension-polyfill";
import {log} from "./safari-logs.js";

// IMPORTANT: The SDK uses globalThis.browser internally (via browser.js
// export), so we must ensure globalThis.browser points to our polyfilled
// browser object. The early polyfill patches it, but we ensure it's set here
// in case the module loads before the early polyfill in some build configs.
if (!globalThis.browser) {
  log("Setting globalThis.browser to webextension-polyfill browser");
  globalThis.browser = browser;
}

// =========================================================================
// HISTORY STATE CHANGE LISTENER SHIM
// =========================================================================

// Safari doesn't support webNavigation.onHistoryStateUpdated, so we create
// a shim that receives events from content scripts via messaging.

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

// =========================================================================
// WAIT FOR WEB NAVIGATION
// =========================================================================

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

// =========================================================================
// PATCH FOR SAFARI
// =========================================================================

/**
 * Apply Safari-specific patches for the SDK.
 *
 * Basic polyfills (webRequest, DNR, runtime, etc.) are handled by
 * safari-polyfill-early.js which runs before any modules load.
 *
 * This function handles:
 * - Waiting for webNavigation to be available (if doWaitForWebNavigation=true)
 * - Patching onHistoryStateUpdated with our shim
 *
 * @param {boolean} doWaitForWebNavigation - Whether to wait for webNavigation
 *   and patch onHistoryStateUpdated. Default is true.
 */
export async function patchForSafari(doWaitForWebNavigation = true) {
  log("patchForSafari() called, doWaitForWebNavigation=" + doWaitForWebNavigation);

  try {
    if (doWaitForWebNavigation) {
      console.log("webNavigation", browser.webNavigation);
      log("webNavigation before await:");
      log(browser.webNavigation);
      await waitForWebNavigation();
      log("webNavigation after await:");
      log(browser.webNavigation);

      // Patch onHistoryStateUpdated with our shim if not already present
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
    console.error("Failed to patch Safari:", e);
  }
}

// =========================================================================
// HISTORY STATE UPDATE HANDLER
// =========================================================================

/**
 * Handle history state update events from Safari content scripts.
 *
 * Safari doesn't support webNavigation.onHistoryStateUpdated natively,
 * so content scripts send messages when they detect history state changes.
 * This function routes those events to registered listeners.
 *
 * @param {number} tabId - The tab ID where the event occurred
 * @param {number} frameId - The frame ID where the event occurred
 * @param {Object} event - The event details
 */
export function onHistoryStateUpdatedSafari(tabId, frameId, event) {
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
