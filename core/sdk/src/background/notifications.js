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

import {init as initPrefs} from "./prefs.js";

import {notifications as _notifications} from "adblockpluscore/lib/notifications.js";

const NOTIFICATION_KEY = "ewe:notifications";
class NotificationSessionStorageBackend {
  constructor() {
    this.local = new Set();
    this.loaded = this.load();
  }

  add(notification) {
    this.local.add(notification);
    this.save();
  }

  delete(notification) {
    let removed = this.local.delete(notification);
    if (removed) {
      this.save();
    }

    return removed;
  }

  [Symbol.iterator]() {
    return this.local[Symbol.iterator]();
  }

  async load() {
    let result = await browser.storage.session.get([NOTIFICATION_KEY]);
    let loadedNotifications = result[NOTIFICATION_KEY] || [];
    for (let notification of loadedNotifications) {
      this.local.add(notification);
    }
  }

  async save() {
    await this.loaded;
    if (!this.debounceTimer) {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.saveImmediate();
      }, 0);
    }
  }

  async saveImmediate() {
    await browser.storage.session.set({
      [NOTIFICATION_KEY]: [...this.local]
    });
  }
}

if (browser.storage.session) {
  _notifications.setLocalNotificationStorage(
    new NotificationSessionStorageBackend()
  );
}

let funcsThatRequirePrefs = [
  "start",
  "shouldIgnoreNotifications",
  "showNotification",
  "showNext",
  "markAsShown",
  "toggleIgnoreCategory",
  "getDownloadCount",
  "getIgnoredCategories"
];

/**
 * The notifications API (optional usage).
 *
 * Call `notifications.start()` to start downloading remote
 * notifications. Local notifications functions such as
 * `notifications.addNotification(notification)` and
 * `notifications.showNotification(notification)` can be used even if
 * `notifications.start()` has not been called.
 *
 *  Please also notice that notification events are **not** using the
 * {@link #eventdispatcher|EventDispatcher} interface.
 *
 * Note that, when used through EWE, the following notifications
 * functions are asynchronous and return the values specified in the
 * Core documentation wrapped in promises:
 * - start
 * - shouldIgnoreNotifications
 * - showNotification
 * - showNext
 * - markAsShown
 * - toggleIgnoreCategory
 * - getDownloadCount
 * - getIgnoredCategories
 *
 * @see {@link https://eyeo.gitlab.io/adblockplus/abc/adblockpluscore/master/docs/module-notifications.html?job=docs|Adblock Plus core notifications documentation}
 */
export let notifications = new Proxy(_notifications, {
  get(target, prop, receiver) {
    if (funcsThatRequirePrefs.includes(prop)) {
      return async function(...args) {
        await initPrefs();
        return target[prop](...args);
      };
    }
    return target[prop];
  }
});
