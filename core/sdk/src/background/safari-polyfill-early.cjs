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
// safari-polyfill-early.cjs
//
// This file MUST be loaded before ANY other modules, including the SDK.
// It intercepts globalThis.browser to patch Safari-missing DNR APIs.
//
// The webextension-polyfill (bundled in the SDK) creates a Proxy
// that checks `prop in target` before returning values. Safari's
// native chrome.declarativeNetRequest is frozen, so we can't add
// properties to it. Instead, we intercept the globalThis.browser
// assignment and wrap its declarativeNetRequest with our polyfills.
//
// IMPORTANT: This file must NOT use ES module syntax (import/export)
// because it is injected as raw code before the module system loads.
//

/* eslint-disable no-console */
/* global chrome */

(function() {
  // Two-state lifecycle for updateEnabledRulesets:
  //   false (initial) - calls silently resolve during startup
  //   true            - calls go directly to native API
  //
  // Dropping during startup is safe because:
  //   - Rulesets are already enabled via manifest.json at install time
  //   - enabled-state.js polls every 1 second and reconciles real state
  let startupComplete = false;

  if (typeof globalThis !== "undefined") {
    // Switch to passthrough mode.
    // Call this after EWE.start() and checkDefaultSubscriptions() complete.
    globalThis.__safariPolyfillStartupComplete = function() {
      startupComplete = true;
      console.log("[Safari polyfill] Startup complete, updateEnabledRulesets now functional");
    };
  }

  // Safari DNR limits (used for polyfills when native API unavailable)
  // Safari allows ~50,000 static rules on device, but Simulator reports 30,000.
  // We use the lower value for consistency across environments.
  const SAFARI_AVAILABLE_STATIC_RULES = 30000;
  const SAFARI_MAX_DYNAMIC_RULES = 5000;

  // Polyfill functions for declarativeNetRequest
  const dnrPolyfills = {
    getAvailableStaticRuleCount() {
      return SAFARI_AVAILABLE_STATIC_RULES;
    },
    getSessionRules() {
      return [];
    },
    MAX_NUMBER_OF_DYNAMIC_RULES: SAFARI_MAX_DYNAMIC_RULES,
    getEnabledRulesets() {
      // Read enabled rulesets directly from manifest.json
      // - single source of truth.
      // chrome.runtime.getManifest() is available
      // synchronously in Safari extensions.
      let manifest = chrome.runtime.getManifest();
      let resources = manifest.declarative_net_request?.rule_resources || [];
      return resources
        .filter(r => r.enabled)
        .map(r => r.id);
    },
    getDynamicRules() {
      return [];
    },
    updateDynamicRules() {
      // no-op
    }
  };

  // Create a proxy wrapper for declarativeNetRequest that adds missing methods
  // and wraps updateEnabledRulesets with startup protection
  function createDnrProxy(originalDnr) {
    const originalUpdateEnabledRulesets = originalDnr.updateEnabledRulesets;

    return new Proxy(originalDnr, {
      get(target, prop) {
        // Wrap updateEnabledRulesets with startup protection
        if (prop === "updateEnabledRulesets") {
          return options => {
            if (!startupComplete) {
              // During startup: silently resolve to prevent deadlock.
              // Safe because rulesets are enabled via
              // manifest + enabled-state.js reconciles.
              console.log(
                "[Safari polyfill] updateEnabledRulesets dropped during init:",
                options
              );
              return Promise.resolve();
            }
            // After startup: use the real function
            if (typeof originalUpdateEnabledRulesets === "function") {
              return originalUpdateEnabledRulesets.call(target, options);
            }
            return Promise.resolve();
          };
        }

        // Return our polyfill if the property doesn't exist on the original
        if (prop in dnrPolyfills && !(prop in target)) {
          return dnrPolyfills[prop];
        }
        // Otherwise return the original property
        let value = target[prop];
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      },
      has(target, prop) {
        return prop in target || prop in dnrPolyfills;
      }
    });
  }

  // ExecutionWorld polyfill for scripting namespace
  // Safari lacks browser.scripting.ExecutionWorld,
  // causing snippet execution to fail
  // This is needed for YouTube ad-blocking snippets on SPA navigation
  const executionWorldPolyfill = {
    ISOLATED: "ISOLATED",
    MAIN: "MAIN"
  };

  // Create a proxy wrapper for scripting that adds ExecutionWorld
  function createScriptingProxy(originalScripting) {
    return new Proxy(originalScripting, {
      get(target, prop) {
        let value = target[prop];

        // Return our polyfill if ExecutionWorld doesn't
        // exist or is null/undefined
        if (prop === "ExecutionWorld") {
          if (value == null) {
            return executionWorldPolyfill;
          }
          return value;
        }

        // For all other properties, return the original
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      },
      has(target, prop) {
        return prop in target || prop === "ExecutionWorld";
      }
    });
  }

  // Create a proxy wrapper for the browser object that
  // intercepts declarativeNetRequest and scripting
  function createBrowserProxy(originalBrowser) {
    let dnrProxyCache = null;
    let scriptingProxyCache = null;
    return new Proxy(originalBrowser, {
      get(target, prop) {
        if (prop === "declarativeNetRequest" && target.declarativeNetRequest) {
          // Lazily create and cache our DNR proxy
          if (!dnrProxyCache) {
            dnrProxyCache = createDnrProxy(target.declarativeNetRequest);
          }
          return dnrProxyCache;
        }
        if (prop === "scripting") {
          // Lazily create and cache our scripting proxy
          if (!scriptingProxyCache) {
            // Create scripting object if it doesn't exist
            let scripting = target.scripting || {};
            scriptingProxyCache = createScriptingProxy(scripting);
          }
          return scriptingProxyCache;
        }
        // For all other properties, return the original
        let value = target[prop];
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      },
      has(target, prop) {
        return prop in target || prop === "scripting";
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });
  }

  // Intercept globalThis.browser assignment
  // webextension-polyfill will set globalThis.browser when it initializes
  let _browser = globalThis.browser;
  // Track if we've already wrapped to prevent re-wrapping
  let _isProxied = false;

  Object.defineProperty(globalThis, "browser", {
    configurable: true,
    enumerable: true,
    get() {
      return _browser;
    },
    set(newBrowser) {
      // Don't re-wrap if already proxied
      // (prevents losing proxy state on multiple assignments)
      if (_isProxied && newBrowser === _browser) {
        return;
      }

      // Wrap the browser object with our proxy
      // that handles declarativeNetRequest
      if (newBrowser && newBrowser.declarativeNetRequest) {
        _browser = createBrowserProxy(newBrowser);
        _isProxied = true;
      }
      else {
        _browser = newBrowser;
        _isProxied = false;
      }
    }
  });

  // Polyfill webRequest namespace (Safari < iOS 18)
  if (typeof chrome !== "undefined" && !chrome.webRequest) {
    chrome.webRequest = {};
  }

  // Polyfill webRequest.ResourceType enum
  if (typeof chrome !== "undefined" && chrome.webRequest && !chrome.webRequest.ResourceType) {
    chrome.webRequest.ResourceType = {
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
      WEBSOCKET: "websocket",
      XMLHTTPREQUEST: "xmlhttprequest"
    };
  }

  // Polyfill webRequest events as no-ops
  // NOTE: onSendHeaders is required by EWE SDK 3.0.1 for DNR request reporting
  if (typeof chrome !== "undefined" && chrome.webRequest) {
    const events = [
      "onBeforeRequest",
      "onBeforeSendHeaders",
      "onSendHeaders",
      "onHeadersReceived",
      "onResponseStarted",
      "onBeforeRedirect",
      "onCompleted",
      "onErrorOccurred"
    ];
    events.forEach(eventName => {
      if (!chrome.webRequest[eventName]) {
        chrome.webRequest[eventName] = {
          addListener() {},
          removeListener() {},
          hasListener() {
            return false;
          }
        };
      }
    });
  }

  // Polyfill runtime.OnInstalledReason
  if (typeof chrome !== "undefined" && chrome.runtime && !chrome.runtime.OnInstalledReason) {
    chrome.runtime.OnInstalledReason = {
      UPDATE: "update"
    };
  }

  // Polyfill webNavigation.onCreatedNavigationTarget
  if (
    typeof chrome !== "undefined" &&
    chrome.webNavigation &&
    !chrome.webNavigation.onCreatedNavigationTarget
  ) {
    chrome.webNavigation.onCreatedNavigationTarget = {
      addListener() {}
    };
  }

  console.log("[Safari polyfill] Early polyfill complete");
})();
