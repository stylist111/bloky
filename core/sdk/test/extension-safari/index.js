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

// Safari polyfills are fully handled by safari-polyfill-early.cjs which is
// injected at the very start of the bundle via webpack BannerPlugin.
// The Proxy-based approach intercepts all DNR API access, so no
// post-SDK-load patching is needed.

// Import console capture first to intercept all logs
import {getLogs, clearLogs} from "./console.js";
import * as ewe from "./ewe.js";
import {getSubscriptions, setSubscriptionEnabled} from "./subscriptions.js";

try {
  ewe.start({
    heavyDependenciesPath: "/ewe-heavy-dependencies.js"
  });
}
catch (e) {
  console.error(`Failed to start EWE: ${e}`);
}

// ============ MESSAGE HANDLERS ============

browser.runtime.onMessage.addListener(message => {
  // Get all subscriptions
  if (message.type === "getSubscriptions") {
    return getSubscriptions()
      .then(subs => ({subscriptions: subs}))
      .catch(err => ({error: err.message}));
  }

  // Enable/disable a subscription
  if (message.type === "setSubscriptionEnabled") {
    // eslint-disable-next-line no-console
    console.log(`Setting subscription ${message.enabled ? "enabled" : "disabled"}: ${message.url}`);
    return setSubscriptionEnabled(message.url, message.enabled)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log("Subscription toggled successfully");
        return {success: true};
      })
      .catch(err => ({error: err.message}));
  }

  // Get logs
  if (message.type === "getLogs") {
    return Promise.resolve(getLogs());
  }

  // Clear logs
  if (message.type === "clearLogs") {
    clearLogs();
    // eslint-disable-next-line no-console
    console.log("Logs cleared");
    return Promise.resolve({success: true});
  }

  // Get startup info
  if (message.type === "getStartupInfo") {
    return Promise.resolve(ewe.getStartupInfo());
  }

  return false;
});
