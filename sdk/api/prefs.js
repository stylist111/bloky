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

import browser from "webextension-polyfill";
import {EventEmitter} from "adblockpluscore/lib/events.js";

let eventEmitter = new EventEmitter();
let database;

let prefs = Object.create({
  analytics: {trustedHosts: ["adblockplus.org",
                             "notification.adblockplus.org",
                             "easylist-downloads.adblockplus.org"]},
  blocked_total: 0,
  elemhide_debug: false,
  notificationdata: {},
  notifications_ignoredcategories: [],
  notificationurl: "https://notification.adblockplus.org/notification.json",
  patternsbackupinterval: 24,
  patternsbackups: 0,
  savestats: false,
  show_statsinpopup: true,
  subscriptions_autoupdate: true,
  subscriptions_fallbackerrors: 5,
  subscriptions_fallbackurl: "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&responseStatus=%RESPONSESTATUS%",

  on(preference, callback)
  {
    eventEmitter.on(preference, callback);
  },

  off(preference, callback)
  {
    eventEmitter.off(preference, callback);
  }
});

function updatePref(name, updateIDB)
{
  updateIDB(database.transaction(["prefs"], "readwrite").objectStore("prefs"));
  eventEmitter.emit(name);
}

export let Prefs = new Proxy(prefs, {
  set(obj, name, value)
  {
    obj[name] = value;
    updatePref(name, store => store.put({name, value}));
    return true;
  },

  deleteProperty(obj, name)
  {
    delete obj[name];
    updatePref(name, store => store.delete(name));
    return true;
  }
});

async function migratePrefs(db, legacyStorageItems)
{
  let keys = [];

  await new Promise((resolve, reject) =>
  {
    let tx = db.transaction(["prefs"], "readwrite");
    let store = tx.objectStore("prefs");

    for (let name in prefs)
    {
      let key = `pref:${name}`;

      if (key in legacyStorageItems)
      {
        store.put({name, value: legacyStorageItems[key]});
        keys.push(key);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = event => reject(event.target.error);
  });

  if (keys.length > 0)
    browser.storage.local.remove(keys);
}

function loadPrefs(db)
{
  return new Promise((resolve, reject) =>
  {
    let tx = db.transaction(["prefs"], "readonly");
    let store = tx.objectStore("prefs");

    store.getAll().onsuccess = event => resolve(event.target.result);
    tx.onerror = tx.onabort = event => reject(event.target.error);
  });
}

export async function init(db, legacyStorageItems)
{
  await migratePrefs(db, legacyStorageItems);

  for (let {name, value} of await loadPrefs(db))
    prefs[name] = value;

  database = db;
}
