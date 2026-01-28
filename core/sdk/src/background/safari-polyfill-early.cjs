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
// This file runs BEFORE any other modules, including the SDK.
// It is injected at the very start of the bundle via webpack BannerPlugin.
//
// IMPORTANT: This file must NOT use ES module syntax (import/export)
// because it is injected as raw code before the module system loads.
//
// This file patches BOTH chrome.* (before webextension-polyfill wraps them)
// AND browser.* (which Safari provides natively).
//

/* eslint-disable no-console */
/* global chrome */

(function() {
  // Safari doesn't provide getAvailableStaticRuleCount API. This constant is
  // used as a fallback return value. The value matches Chrome's guaranteed
  // minimum static rule count (30,000). Safari's actual limit may differ.
  const SAFARI_STATIC_RULE_COUNT_FALLBACK = 30000;

  // Track whether startup is complete - after subscriptions are loaded,
  // updateEnabledRulesets can work normally
  let startupComplete = false;

  // Expose a function to signal startup is complete
  // This should be called after EWE.start() and subscriptions are loaded
  if (typeof globalThis !== "undefined") {
    globalThis.__safariPolyfillStartupComplete = function() {
      startupComplete = true;
      console.log("[Safari polyfill] Startup complete, updateEnabledRulesets now functional");
    };
  }

  // =========================================================================
  // POLYFILL DEFINITIONS
  // =========================================================================

  // ResourceType enum - Safari doesn't include this
  const RESOURCE_TYPE = {
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

  // WebRequest events to stub
  const WEB_REQUEST_EVENTS = [
    "onBeforeRequest",
    "onBeforeSendHeaders",
    "onSendHeaders",
    "onHeadersReceived",
    "onResponseStarted",
    "onBeforeRedirect",
    "onCompleted",
    "onErrorOccurred"
  ];

  // Rulesets enabled in manifest.json - must match the manifest!
  // This ensures the SDK sees the correct initial state and doesn't try
  // to disable rulesets unnecessarily during startup.
  const MANIFEST_ENABLED_RULESETS = [
    "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F", // Acceptable Ads
    "8C13E995-8F06-4927-BEA7-6C845FB7EEBF", // EasyList
    "D4028CDD-3D39-4624-ACC7-8140F4EC3238"  // Anti-CV
  ];

  /**
   * Wrap updateEnabledRulesets with startup protection.
   * Safari's updateEnabledRulesets fails with "Failed to apply rules" when
   * the SDK tries to disable manifest-enabled rulesets on startup (before
   * subscriptions are loaded). Since rulesets are already enabled in manifest,
   * blocking all calls during startup still allows blocking to work.
   * After startup completes, we allow the real function to work.
   * @param {Object} dnr - The declarativeNetRequest object to patch
   */
  function wrapUpdateEnabledRulesets(dnr) {
    if (!dnr || dnr._updateEnabledRulesetsWrapped) {
      return;
    }
    let originalFn = dnr.updateEnabledRulesets;
    dnr.updateEnabledRulesets = function(options) {
      if (!startupComplete) {
        return Promise.resolve();
      }
      if (typeof originalFn === "function") {
        return originalFn.call(dnr, options);
      }
      return Promise.resolve();
    };
    dnr._updateEnabledRulesetsWrapped = true;
  }

  // DNR stub implementations
  const dnrStubs = {
    getAvailableStaticRuleCount() {
      return Promise.resolve(SAFARI_STATIC_RULE_COUNT_FALLBACK);
    },
    getSessionRules() {
      return Promise.resolve([]);
    },
    getEnabledRulesets() {
      // Return the rulesets that are enabled in manifest.json
      // This prevents the SDK from trying to disable them on startup
      return Promise.resolve([...MANIFEST_ENABLED_RULESETS]);
    },
    getDynamicRules() {
      return Promise.resolve([]);
    },
    updateDynamicRules() {
      return Promise.resolve();
    },
    MAX_NUMBER_OF_DYNAMIC_RULES: 5000
  };

  // =========================================================================
  // PATCHING FUNCTIONS
  // =========================================================================

  /**
   * Patch webRequest namespace on a target object (chrome or browser)
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchWebRequest(target, targetName) {
    if (!target) {
      return;
    }

    // Polyfill webRequest namespace (Safari < iOS 18)
    if (!target.webRequest) {
      // Polyfilling missing webRequest namespace
      target.webRequest = {};
    }

    // Polyfill ResourceType enum
    if (!target.webRequest.ResourceType) {
      // Polyfilling webRequest.ResourceType
      target.webRequest.ResourceType = {...RESOURCE_TYPE};
    }

    // Polyfill webRequest events as no-ops
    WEB_REQUEST_EVENTS.forEach(eventName => {
      if (!target.webRequest[eventName]) {
        target.webRequest[eventName] = {
          addListener() {
            // Stub addListener called
          },
          removeListener() {},
          hasListener() {
            return false;
          }
        };
      }
    });
  }

  /**
   * Patch runtime namespace on a target object
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchRuntime(target, targetName) {
    if (!target || !target.runtime) {
      return;
    }

    if (!target.runtime.OnInstalledReason) {
      target.runtime.OnInstalledReason = {
        UPDATE: "update"
      };
    }
  }

  /**
   * Patch webNavigation namespace on a target object
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchWebNavigation(target, targetName) {
    if (!target || !target.webNavigation) {
      return;
    }

    if (!target.webNavigation.onCreatedNavigationTarget) {
      target.webNavigation.onCreatedNavigationTarget = {
        addListener() {}
      };
    }
  }

  /**
   * Patch scripting namespace on a target object
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchScripting(target, targetName) {
    if (!target || !target.scripting) {
      return;
    }

    // Safari may have ExecutionWorld as null/undefined, or missing MAIN value
    // We need ExecutionWorld.MAIN for snippet injection into the main world
    let needsExecutionWorldPatch =
      !target.scripting.ExecutionWorld ||
      typeof target.scripting.ExecutionWorld.MAIN === "undefined";

    if (needsExecutionWorldPatch) {
      target.scripting.ExecutionWorld = {
        ...target.scripting.ExecutionWorld,
        ISOLATED: "ISOLATED",
        MAIN: "MAIN"
      };
    }
  }

  /**
   * Patch declarativeNetRequest namespace on a target object
   * Includes startup protection for updateEnabledRulesets
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchDeclarativeNetRequest(target, targetName) {
    if (!target) {
      return;
    }

    // Ensure declarativeNetRequest namespace exists
    if (!target.declarativeNetRequest) {
      target.declarativeNetRequest = {};
    }

    let dnr = target.declarativeNetRequest;

    // Patch each stub method
    Object.keys(dnrStubs).forEach(key => {
      if (typeof dnrStubs[key] === "function") {
        if (typeof dnr[key] !== "function") {
          dnr[key] = dnrStubs[key];
        }
      }
      else if (!dnr[key]) {
        dnr[key] = dnrStubs[key];
      }
    });

    wrapUpdateEnabledRulesets(dnr);
  }

  /**
   * Apply all patches to a target object (chrome or browser)
   * @param {Object} target - The target object to patch (chrome or browser)
   * @param {string} targetName - Name of the target for logging
   */
  function patchAll(target, targetName) {
    if (!target) {
      return;
    }

    patchWebRequest(target, targetName);
    patchRuntime(target, targetName);
    patchWebNavigation(target, targetName);
    patchScripting(target, targetName);
    patchDeclarativeNetRequest(target, targetName);
  }

  // =========================================================================
  // LAZY API INTERCEPTOR
  // =========================================================================

  /**
   * Use a getter/setter to intercept future access to declarativeNetRequest.
   * This handles the case where Safari lazily provides the API after our
   * polyfill runs.
   * @param {Object} target - The target object to install interceptor on
   * @param {string} targetName - Name of the target for logging
   */
  function installDnrInterceptor(target, targetName) {
    if (!target) {
      return;
    }

    let originalDnr = target.declarativeNetRequest;
    let patchedDnr = null;

    try {
      Object.defineProperty(target, "declarativeNetRequest", {
        configurable: true,
        enumerable: true,
        get() {
          if (patchedDnr) {
            return patchedDnr;
          }

          let currentDnr = originalDnr;

          if (currentDnr) {
            // Apply our stubs to any missing methods
            Object.keys(dnrStubs).forEach(key => {
              if (typeof dnrStubs[key] === "function") {
                if (typeof currentDnr[key] !== "function") {
                  currentDnr[key] = dnrStubs[key];
                }
              }
              else if (!currentDnr[key]) {
                currentDnr[key] = dnrStubs[key];
              }
            });

            wrapUpdateEnabledRulesets(currentDnr);

            patchedDnr = currentDnr;
            return patchedDnr;
          }

          if (!patchedDnr) {
            patchedDnr = {...dnrStubs};
            wrapUpdateEnabledRulesets(patchedDnr);
          }
          return patchedDnr;
        },
        set(newValue) {
          originalDnr = newValue;
          patchedDnr = null;
        }
      });
    }
    catch (e) {
      // Silently fail if we can't install the interceptor
    }
  }

  // =========================================================================
  // APPLY PATCHES
  // =========================================================================

  // Patch chrome.* (before webextension-polyfill wraps them)
  if (typeof chrome !== "undefined") {
    console.log("[Safari polyfill] Patching chrome.*");
    patchAll(chrome, "chrome");
  }

  // CRITICAL: Safari provides globalThis.browser with runtime.id, which
  // causes webextension-polyfill to skip wrapping and export the native
  // browser object. We must patch globalThis.browser BEFORE the polyfill runs.
  if (typeof globalThis !== "undefined" && globalThis.browser) {
    console.log("[Safari polyfill] Patching globalThis.browser");
    patchAll(globalThis.browser, "globalThis.browser");
    installDnrInterceptor(globalThis.browser, "globalThis.browser");
  }

  // Also patch window.browser if it exists (Safari sometimes uses this)
  if (typeof window !== "undefined" &&
      window.browser &&
      window.browser !== globalThis.browser) {
    console.log("[Safari polyfill] Patching window.browser");
    patchAll(window.browser, "window.browser");
    installDnrInterceptor(window.browser, "window.browser");
  }

  console.log("[Safari polyfill] Early polyfill complete");
})();
