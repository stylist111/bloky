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

// Safari polyfills are handled by safari-polyfill-early.js which is
// injected at the very start of the bundle via webpack BannerPlugin.
// Additional post-SDK-load patching is done below.

import * as ewe from "./ewe.js";

// Safari doesn't implement getAvailableStaticRuleCount(), so this value is
// used as a fallback return value. The value matches Chrome's guaranteed
// minimum static rule count (30,000). Safari's actual limit may differ.
const SAFARI_STATIC_RULE_COUNT_FALLBACK = 30000;

// CRITICAL: Patch browser.declarativeNetRequest AFTER SDK loads
// The SDK bundles its own webextension-polyfill which may create
// a different browser object that needs patching
function patchBrowserDnr() {
  // Patch globalThis.browser which the SDK uses
  if (globalThis.browser && globalThis.browser.declarativeNetRequest) {
    const dnr = globalThis.browser.declarativeNetRequest;
    if (typeof dnr.getAvailableStaticRuleCount !== "function") {
      dnr.getAvailableStaticRuleCount = () =>
        Promise.resolve(SAFARI_STATIC_RULE_COUNT_FALLBACK);
    }
    if (typeof dnr.getSessionRules !== "function") {
      dnr.getSessionRules = () => Promise.resolve([]);
    }
  }
}
patchBrowserDnr();

try {
  ewe.start();
}
catch (e) {
  console.error(`Failed to start: ${e}`);
}
