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

import browser from "./browser.js";
import {mergeObjects} from "./set-operations.js";

export class PersistentState {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.activeSaveActions = new Set();
    this.loaded = false;

    this.clearState();
  }

  clearState() {
    this.state = {};
  }

  getState() {
    return this.state;
  }

  async load(savedStateCallback = null) {
    let persistObj = await browser.storage.session.get(this.storageKey);
    if (!persistObj || !persistObj[this.storageKey]) {
      this.loaded = true;
      return;
    }

    let savedState = persistObj[this.storageKey];

    if (savedStateCallback) {
      savedStateCallback(savedState);
    }

    // We might have populated state until loading is finished.
    // Thus we might need to merge the saved and new runtime state.
    this.state = mergeObjects(savedState, this.state);
    this.loaded = true;
  }

  async save() {
    let obj = {};
    obj[this.storageKey] = this.state;
    return this._trackSaving(browser.storage.session.set(obj));
  }

  async awaitSavingComplete() {
    if (Promise.allSettled) {
      await Promise.allSettled(this.activeSaveActions);
      return;
    }

    // Promise.allSettled isn't supported in oldest Firefox.
    // It was added in Firefox 71.
    for (let saveAction of this.activeSaveActions) {
      try {
        await saveAction;
      }
      catch (e) {
      }
    }
  }

  _trackSaving(savePromise) {
    this.activeSaveActions.add(savePromise);
    savePromise.finally(() => this.activeSaveActions.delete(savePromise));
    return savePromise;
  }
}
