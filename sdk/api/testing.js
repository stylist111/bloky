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

import {filterEngine} from "./core.js";
import {Prefs} from "./prefs.js";
import {default as debugging} from "./debugging.js";
import {setAddonInfo, addonBundledSubscriptionsPath} from "./info.js";

export default {
  /**
   * @ignore
   * Used internally. Sets the preference value.
   * @param {string} [key] Preference key
   * @param {Object} [value] Preference value
   */
  _setPrefs(key, value) {
    Prefs[key] = value;
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

  _setAddonInfo: setAddonInfo
};
