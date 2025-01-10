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
import {EventEmitter} from "adblockpluscore/lib/events.js";
import {MILLIS_IN_SECOND, MILLIS_IN_MINUTE, MILLIS_IN_HOUR}
  from "adblockpluscore/lib/time.js";
import {getDatabase} from "./io-idb.js";

// MV2
// (all the subscriptions are downloadable)
export const MIGRATED_TO_MV2 = 0;

// MV3 without diff updates
// (anti-cv subscription is the only `FullUpdatableSubscription`)
export const MIGRATED_TO_MV3_WITHOUT_DIFF = 1;

// MV3 with diff updates
// (all subscriptions are either
// `CountableSubscription` or `DiffUpdatableSubscriptions`)
export const MIGRATED_TO_MV3 = 2;

export const CDP_OPTED_IN = 0;
export const CDP_OPTED_OUT = 1;
export const CDP_OPTED_IN_BY_USER = 2;
export const CDP_OPTED_OUT_BY_USER = 3;

export const defaults = Object.create({
  analytics: {trustedHosts: ["adblockplus.org",
                             "notification.adblockplus.org",
                             "easylist-downloads.adblockplus.org"]},
  dynamic_filters: [],
  notificationdata: {},
  notifications_ignoredcategories: [],
  notificationurl: "https://notification.adblockplus.org/notification.json",
  notifications_initial_delay: 1000, // 1 s
  patternsbackupinterval: 24,
  patternsbackups: 0,
  ruleset_updates: [],
  savestats: false,
  show_statsinpopup: true,
  subscriptions_autoupdate: true,
  subscriptions_fallbackerrors: 5,
  subscriptions_fallbackurl: "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&responseStatus=%RESPONSESTATUS%",
  subscriptions_initial_delay: 1000, // 1 s
  subscriptions_check_interval: 1 * MILLIS_IN_HOUR,
  migration_filter_errors: [],
  migration_subscription_errors: [],
  migration_state: MIGRATED_TO_MV2,
  edge_one_click_allowlisting_delay: 2 * MILLIS_IN_SECOND,
  cdp_opt_in_out: CDP_OPTED_IN,
  cdp_session_expiration_interval: 30 * MILLIS_IN_MINUTE,
  telemetry_opt_out: true
});

export let Prefs = {
  on(preference, callback) {
    eventEmitter.on(preference, callback);
  },
  off(preference, callback) {
    eventEmitter.off(preference, callback);
  }
};

const KEY_PREFIX = "abp:pref:";

let eventEmitter = new EventEmitter();
let overrides = new Map();
let initializationPromise;

function keyToPref(key) {
  return key.startsWith(KEY_PREFIX) ? key.substr(KEY_PREFIX.length) : null;
}

function prefToKey(pref) {
  return `${KEY_PREFIX}${pref}`;
}

let activeSaveActions = new Set();

function trackSaving(savePromise) {
  activeSaveActions.add(savePromise);
  savePromise.finally(() => activeSaveActions.delete(savePromise));
  return savePromise;
}

export async function awaitSavingComplete() {
  if (Promise.allSettled) {
    await Promise.allSettled(activeSaveActions);
    return;
  }

  // Promise.allSettled isn't supported in oldest Firefox.
  // It was added in Firefox 71.
  for (let saveAction of activeSaveActions) {
    try {
      await saveAction;
    }
    catch (e) {
    }
  }
}

function addPreference(preference) {
  Object.defineProperty(Prefs, preference, {
    get() {
      if (overrides.has(preference)) {
        return overrides.get(preference);
      }

      let defaultValue = defaults[preference];
      // Arrays and Objects are deeply copied
      // to avoid modifications of `defaults`
      return Array.isArray(defaultValue) ||
        (typeof defaultValue === "object" && defaultValue !== null) ?
          JSON.parse(JSON.stringify(defaultValue)) :
          defaultValue;
    },
    set(value) {
      let key = prefToKey(preference);
      if (value === defaults[preference]) {
        overrides.delete(preference);
        trackSaving(browser.storage.local.remove(key));
        return;
      }

      overrides.set(preference, value);
      trackSaving(browser.storage.local.set({[key]: value}));
    },
    enumerable: true
  });
}

export async function migratePrefs(db) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction(["prefs"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = event => reject(event.target.error);

    let prefsStore;
    try {
      prefsStore = tx.objectStore("prefs");
    }
    catch (e) {
      // no "prefs" object store
      return;
    }
    prefsStore.getAll().onsuccess = event => {
      for (let {name, value} of event.target.result) {
        savePreference(name, value);
      }
      prefsStore.clear();
    };
  });
}

function savePreference(name, value) {
  let key = prefToKey(name);
  overrides.set(name, value);
  trackSaving(browser.storage.local.set({[key]: value}));
}

async function loadPreferences() {
  let prefs = Object.keys(Object.getPrototypeOf(defaults));
  prefs.forEach(addPreference);

  let items = await browser.storage.local.get(prefs.map(prefToKey));
  for (let key in items) {
    overrides.set(keyToPref(key), items[key]);
  }
}

export async function init() {
  if (!initializationPromise) {
    initializationPromise = (async() => {
      try {
        let db = getDatabase();
        await migratePrefs(db);
      }
      catch (e) {
        // db might be unavailable
      }

      await loadPreferences();
    })();
  }

  return initializationPromise;
}
