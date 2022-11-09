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

import {FilterStorage} from "adblockpluscore/lib/filterStorage.js";

import {IO} from "./io.js";
import {addonBundledSubscriptions, addonBundledSubscriptionsPath,
        addonName, addonVersion, manifestVersion} from "./info.js";
import {filterEngine} from "./core.js";
import {awaitSavingComplete} from "./prefs.js";
import {validate} from "./subscriptions.js";
import {isRunningInServiceWorker} from "./browser-features.js";

export let debugOptions = {
  elemHide: false,
  cssProperties: [["background", "#e67370"], ["outline", "solid red"]],
  snippetsCssProperties: [
    ["background", "repeating-linear-gradient(to bottom, #e67370 0," +
     "#e67370 9px, white 9px, white 10px)"],
    ["outline", "solid red"]]
};

const STORAGE_KEY = "ewe:debugOptions";
let savingPromise = Promise.resolve(null);
let storage = browser.storage.local;

export async function saveDebugOptions() {
  if (!isRunningInServiceWorker())
    return;

  await savingPromise;

  let obj = {};
  obj[STORAGE_KEY] = JSON.stringify(debugOptions);
  savingPromise = storage.set(obj);
  await savingPromise;
}

export async function loadDebugOptions() {
  if (!isRunningInServiceWorker())
    return;

  let obj = await storage.get(STORAGE_KEY);
  if (!obj || !obj[STORAGE_KEY])
    return;

  debugOptions = JSON.parse(obj[STORAGE_KEY]);
}

let initializationPromise;

export default {
  /**
   * AddonInfo assigned during start.
   * @type {Object}
   * @property {string} name
   * @property {string} version
   */
  get addonInfo() {
    return {
      name: addonName,
      version: addonVersion,
      bundledSubscriptions: addonBundledSubscriptions,
      bundledSubscriptionsPath: addonBundledSubscriptionsPath,
      manifestVersion
    };
  },

  /**
   * Causes elements targeted by element hiding, element hiding emulation,
   * or snippets to be highlighted instead of hidden.
   * @param {boolean} enabled Enables or disables debug mode.
   * @returns {Promise}
   */
  async setElementHidingDebugMode(enabled) {
    await this.start();
    debugOptions.elemHide = enabled;
    await saveDebugOptions();
  },

  /**
   * Updates the element hiding debug style.
   * @param {Object} cssProperties The css properties for
   *                               the debug element.
   * @param {Object} snippetsCssProperties The css properties for
   *                                       the debug snippet element.
   * @returns {Promise}
   */
  async setElementHidingDebugStyle(cssProperties, snippetsCssProperties) {
    await this.start();

    if (cssProperties)
      debugOptions.cssProperties = cssProperties;

    if (snippetsCssProperties)
      debugOptions.snippetsCssProperties = snippetsCssProperties;

    await saveDebugOptions();
  },

  /**
   * @ignore
   * @param {string} text
   */
  async isInFilterStorage(text) {
    let contents = [];
    await IO.readFromFile(FilterStorage.sourceFile,
                          line => contents.push(line));
    return contents.some(line => line.includes(text));
  },

  /**
   * @ignore
   * Used internally. Returns a list of warnings in the context of validating
   * that a user has provided the appropriate files to the extension.
   * @param {Array<Recommendation>} [addonInfo.bundledSubscriptions]
   *   A list of subscriptions provided by the integrator.
   * @param {string} [addonInfo.bundledSubscriptionsPath]
   *   A path to subscription files provided by the integrator.
   * @return {Array<String>}
   */
  validateSubscriptions: validate,

  /**
   * @ignore
   * Used internally. Waits for any pending save actions to complete.
   * @return {Promise}
   */
  async ensureEverythingHasSaved() {
    let {filterStorage} = filterEngine;
    if (filterStorage) {
      // It would be better if filterStorage gave a promise to await for this.
      // https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/464
      while (filterStorage._saving)
        await new Promise(r => setTimeout(r, 10));
    }

    await awaitSavingComplete();
  },

  async start() {
    if (!initializationPromise)
      initializationPromise = loadDebugOptions();
    return initializationPromise;
  },

  async ensureSaved() {
    await savingPromise;
  }
};
