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

import {Subscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {setRecommendations} from "adblockpluscore/lib/recommendations.js";
import {notifications} from "adblockpluscore/lib/notifications.js";

import {filterEngine} from "./core.js";
import {Prefs, awaitSavingComplete, init as initPrefs} from "./prefs.js";
import {default as debugging} from "./debugging.js";
import {default as subs} from "./subscriptions.js";
import {setAddonInfo, addonBundledSubscriptionsPath} from "./info.js";
import {removeDynamicFilters} from "./dnr-filters.js";
import {getMatchedFilters} from "./reporting-requester.js";
import {clearMatchedFilterEvents, setForceEnableTracing} from "./diagnostics.js";
import {resetClearCounter, setLastCheckTimestamp} from "./reporting.js";

import * as sitekey from "./sitekey.js";

export default {
  ...sitekey, // everything exported from "sitekey.js"
  _getMatchedFilters: getMatchedFilters,

  /**
   * @ignore
   * Used internally. Sets the preference value.
   * @param {string} [key] Preference key
   * @param {Object} [value] Preference value
   */
  async _setPrefs(key, value) {
    await initPrefs();
    Prefs[key] = value;
  },

  /**
   * @ignore
   * Used internally. Gets the preference value.
   * @param {string} [key] Preference key
   * @returns {Object} Preference value
   */
  async _getPrefs(key) {
    await initPrefs();
    return Prefs[key];
  },

  /**
   * @ignore
   * Used internally. Restart the Synchronizer.
   */
  _restartSynchronizer() {
    let {filterStorage} = filterEngine;
    filterStorage.synchronizer.stop();
    filterStorage.synchronizer.start();
  },

  /**
   * @ignore
   * Used internally. Sets the subscription property.
   * @param {string} [url] Subscription URL
   * @param {Object} [prototype] Object to set the subscription properties from.
   */
  async _setSubscriptionProperties(url, prototype) {
    let subscription = Subscription.fromURL(url);
    for (let property in prototype)
      subscription[property] = prototype[property];

    await filterEngine.filterStorage.saveToDisk();
    await debugging.ensureEverythingHasSaved();
  },

  /**
   * @ignore
   * @param {Recommendation} subscriptions
   */
  _setSubscriptions(subscriptions) {
    setAddonInfo({bundledSubscriptions: subscriptions,
                  bundledSubscriptionsPath: addonBundledSubscriptionsPath});
    setRecommendations(subscriptions);
  },

  _setAddonInfo: setAddonInfo,

  /**
   * @ignore
   * Clears all subscriptions and filters.
   * @return {Promise} A function that can be called to
   *                    restore the removed subscriptions and filters.
   */
  async _removeAllSubscriptions() {
    for (let subscription of await subs.getDownloadable())
      await subs.remove(subscription.url);

    await removeDynamicFilters();

    const {filterStorage} = filterEngine;
    for (let subscription of filterStorage.subscriptions())
      filterStorage.removeSubscription(subscription);
  },

  async _clearNotifications() {
    await initPrefs();
    for (let notification of notifications._localNotifications)
      notifications.removeNotification(notification);

    Prefs.notificationdata = {};
    Prefs.notifications_ignoredcategories = [];
    await awaitSavingComplete();
  },

  async clearFilterMatches() {
    clearMatchedFilterEvents();
    resetClearCounter();
  },

  setLastCheckTimestamp,
  setForceEnableTracing,

  enableDebugOutput(enabled) {
    if (enabled)
      debugging.onLogEvent.addListener(debugging.CONSOLE_LOGGER);
    else
      debugging.onLogEvent.removeListener(debugging.CONSOLE_LOGGER);
  },

  CONSOLE_LOGGER: debugging.logger
};
