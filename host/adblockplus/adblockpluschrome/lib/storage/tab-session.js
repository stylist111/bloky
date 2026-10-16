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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { pageEmitter } from "../../../src/core/pages/background";
import { EventEmitter } from "../events.js";
import { SessionStorage } from "./session.js";

/**
 * Reason to clear Tab specific data
 */
const clearStorageReason = {
  startup: "startup",
  tabRemoval: "tabRemoval"
};

/**
 * Session storage instance for storing tab-specific data.
 * @type {SessionStorage<number,any>}
 */
const sessionByTabId = new SessionStorage("_tabs");

// We need to keep track of all tab session storage instances so that we can
// notify them about tab changes. Since we cannot iterate through a WeakSet,
// and since WeakRef is not yet available in all supported browsers, this means
// that we're adding them into memory without removing them. As long as we only
// create instances only right when the extension loads, this should not create
// a memory leak though.
/**
 * List of known tab session storage instances.
 * @type {Set<TabSessionStorage>}
 */
const tabStorages = new Set();

/**
 * Closed tabs, so a late `set` or `update` can't recreate their data.
 * Not applied to `setIfAbsent`, as OPDs dismiss a dialog it rejects.
 * @type {Set<number>}
 */
const removedTabIds = new Set();

/**
 * Number of closed tabs remembered in `removedTabIds`. Late writes land
 * shortly after a tab closes, so only the most recent ones are needed.
 */
export const maxRemovedTabIds = 1000;

/**
 * Remembers a closed tab, forgetting the oldest one once over the limit.
 * @param {number} tabId
 */
function addRemovedTabId(tabId) {
  removedTabIds.add(tabId);
  if (removedTabIds.size > maxRemovedTabIds) {
    const [oldestTabId] = removedTabIds;
    removedTabIds.delete(oldestTabId);
  }
}

/**
 * Session storage for storing tab-specific in-memory data in a way that's safe
 * to use in a service worker context.
 */
export class TabSessionStorage extends EventEmitter {
  /**
   * Initializes session storage.
   * @param {string} namespace
   */
  constructor(namespace) {
    super();

    this._namespace = namespace;
    this._queue = Promise.resolve();
    tabStorages.add(this);
  }

  /**
   * Deletes session storage content specific to given tab ID.
   * @param {number} tabId
   * @return {Promise}
   */
  async delete(tabId) {
    return sessionByTabId.transaction(async () => {
      const session = await sessionByTabId.get(tabId);
      if (!session) return;

      delete session[this._namespace];

      if (Object.keys(session).length) await sessionByTabId.set(tabId, session);
      else await sessionByTabId.delete(tabId);
    });
  }

  /**
   * Emits session storage event relating to given tab ID.
   * @param {string} name
   * @param {number} tabId
   */
  async emit(name, tabId) {
    const session = await sessionByTabId.get(tabId);
    if (!session) return;

    super.emit(name, {
      tabId,
      value: session[this._namespace]
    });
  }

  /**
   * Retrieves session storage content specific to given tab ID.
   * @param {number} tabId
   * @return {Promise<any>}
   */
  async get(tabId) {
    const session = await sessionByTabId.get(tabId);
    if (!session) return;

    return session[this._namespace];
  }

  /**
   * Retrieves session storage content specific to given tab ID, ordered
   * after any write or cleanup already queued for that tab. Use this
   * instead of `get` when a stale read racing an in-flight `clearStorage`
   * from a concurrent top-level navigation or tab removal would be
   * incorrect.
   * @param {number} tabId
   * @return {Promise<any>}
   */
  async getQueued(tabId) {
    return sessionByTabId.transaction(async () => {
      const session = await sessionByTabId.get(tabId);
      if (!session) return;

      return session[this._namespace];
    });
  }

  /**
   * Indicates whether session storage content exists specific to given tab ID.
   * @param {number} tabId
   * @return {Promise<boolean>}
   */
  async has(tabId) {
    const session = await sessionByTabId.get(tabId);
    return !!session && this._namespace in session;
  }

  /**
   * Sets session storage content specific to given tab ID.
   * @param {number} tabId
   * @param {any} value
   * @return {Promise}
   */
  async set(tabId, value) {
    return sessionByTabId.transaction(async () => {
      if (removedTabIds.has(tabId)) return;

      const session = (await sessionByTabId.get(tabId)) || {};
      session[this._namespace] = value;
      await sessionByTabId.set(tabId, session);
    });
  }

  /**
   * Atomically sets session storage content for given tab ID, unless content
   * is already set for that tab ID. Needed by the on-page dialog (OPD)
   * tab-manager to atomically claim a tab, avoiding a race where two
   * concurrent calls both see no dialog assigned yet and both proceed to
   * assign and inject one.
   * @param {number} tabId
   * @param {any} value
   * @return {Promise<boolean>} whether the value was set, false if content
   *   was already present
   */
  async setIfAbsent(tabId, value) {
    return sessionByTabId.transaction(async () => {
      const session = (await sessionByTabId.get(tabId)) || {};
      if (this._namespace in session) return false;

      session[this._namespace] = value;
      await sessionByTabId.set(tabId, session);
      return true;
    });
  }

  /**
   * Atomically updates the tab's value, queued with every other write and
   * cleanup.
   * @param {number} tabId
   * @param {function(any): any} fn - receives the current value and returns
   *   the new one
   * @return {Promise<any>} the new value, or undefined if the tab was closed
   */
  async update(tabId, fn) {
    return sessionByTabId.transaction(async () => {
      if (removedTabIds.has(tabId)) return;

      const session = (await sessionByTabId.get(tabId)) || {};
      const value = fn(session[this._namespace]);
      session[this._namespace] = value;
      await sessionByTabId.set(tabId, session);
      return value;
    });
  }

  /**
   * Sets flag value for given tab ID.
   * @param {number} tabId
   * @param {boolean} value
   * @return {Promise}
   */
  async setFlag(tabId, value) {
    if (value) await this.set(tabId, true);
    else await this.delete(tabId);
  }

  /**
   * Executes given function as a transaction to avoid race conditions.
   * @param {Function} fn
   * @return {Promise}
   */
  async transaction(fn) {
    this._queue = this._queue
      // Necessary to avoid breakage of promise chain
      .catch((e) => ewe.sentry.reportError(e))
      .then(fn);
    return this._queue;
  }
}

/**
 * Clears tab-specific data.
 * @param {number} tabId
 * @param {string} reason
 * @return {Promise}
 */
async function clearStorage(tabId, reason) {
  // Runs as a transaction so this can't interleave with a TabSessionStorage
  // write (e.g. setIfAbsent claiming the tab for a new dialog) that reads the
  // session before this deletes it: without that, the write can land between
  // this function's own read and its delete below and get silently lost.
  return sessionByTabId.transaction(async () => {
    if (reason === clearStorageReason.tabRemoval) addRemovedTabId(tabId);

    // Provide stored data to listeners before removing it
    const session = await sessionByTabId.get(tabId);
    if (session) {
      let eventName = null;
      if (reason === clearStorageReason.tabRemoval) eventName = "tab-removed";
      else if (reason === clearStorageReason.startup)
        eventName = "tab-navigated";

      if (eventName) {
        for (const tabStorage of tabStorages)
          await tabStorage.emit(eventName, tabId);
      }
    }

    await sessionByTabId.delete(tabId);
  });
}

/**
 * Initializes tab-specific session storage.
 */
export function start() {
  // Clear tab-specific data when the tab's content changes
  pageEmitter.on("committed", (page) => {
    void clearStorage(page.id, clearStorageReason.startup);
  });

  // Clear tab-specific data when the tab gets removed
  pageEmitter.on("removed", (tabId) => {
    void clearStorage(tabId, clearStorageReason.tabRemoval);
  });
}
