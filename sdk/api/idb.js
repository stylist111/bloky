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

import {init as initIO} from "./io.js";
import {init as initPrefs} from "./prefs.js";

const DB_NAME = "EWE";
const DB_VERSION = 1;

let initializationPromise;

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      let db = event.target.result;
      db.createObjectStore("file-entries");
      db.createObjectStore("file-contents", {autoIncrement: true});
      db.createObjectStore("prefs", {keyPath: "name"});
    };

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

export function init() {
  if (!initializationPromise) {
    initializationPromise = (async() => {
      try {
        let [db, legacyStorageItems] = await Promise.all([
          openDatabase(),
          browser.storage ? await browser.storage.local.get(null) : {}
        ]);

        await Promise.all([initIO(db, legacyStorageItems),
                           initPrefs(db, legacyStorageItems)]);
      }
      catch (e) {
        initializationPromise = null;
        throw e;
      }
    })();
  }

  return initializationPromise;
}
