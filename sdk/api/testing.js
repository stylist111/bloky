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
import {Subscription, _clean as _cleanSubscriptionClassesCache}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {setRecommendations, recommendations}
  from "adblockpluscore/lib/recommendations.js";
import {notifications} from "adblockpluscore/lib/notifications.js";
import {isFeatureEnabled, setFeatureFlags, resetFeatureFlags}
  from "adblockpluscore/lib/features.js";

import {filterEngine} from "./core.js";
import {Prefs, awaitSavingComplete, init as initPrefs} from "./prefs.js";
import {default as debugging} from "./debugging.js";
import {info, log, debug, warn, error, trace} from "./debugging.js";
import {default as subs, saveMigrationError as saveSubscriptionMigrationError}
  from "./subscriptions.js";
import {clearSkipInitRulesets, checkAndInitSubscriptions} from "./index.js";
import {getDefaultSubscriptions, isSynchronizing} from "./subscriptions.js";
import {default as initializer} from "./initializer.js";
import {setAddonInfo, addonBundledSubscriptionsPath, initializeDefaultAddonInfo}
  from "./info.js";
import {dnrDiffSubscriptionUpdate, dynamicRulesAvailable, getDynamicFilters,
        removeAllDynamicFilters, testSetDynamicRulesAvailable,
        clearIsDnrSubscriptionUpdating}
  from "./dnr-filters.js";
import {getSubscriptionRulesetMap} from "./subscriptions-utils.js";
import {IO} from "./io.js";
import {FilterStorage} from "adblockpluscore/lib/filterStorage.js";
import * as telemetry from "./telemetry.js";
import * as cdpMetricsUploader from "./cdp-metrics-uploader.js";
import * as cdpMetricsUploader2 from "./cdp-metrics-uploader-2.js";
import * as cdpMetricsUploader3 from "./cdp-metrics-uploader-3.js";
import * as cdpEncryption from "./cdp-encryption.js";

import * as sitekey from "./sitekey.js";
import {getDeferredMessages} from "./content-message-deferrer.js";
import * as cdp from "./cdp.js";
import {_clear} from "./frame-state.js";

export default {
  ...sitekey, // everything exported from "sitekey.js"

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
    for (let property in prototype) {
      subscription[property] = prototype[property];
    }

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
    _cleanSubscriptionClassesCache();
  },

  /**
   * @ignore
   * @param {Array} sources An array of sources for recommendations
   */
  _setRecommendations(sources) {
    const result = sources ?
      sources.map(recommendation => recommendation._source) : null;
    setRecommendations(result);
  },

  /**
   * @ignore
   * @returns {Array} An array of recommendations
   */
  _recommendations() {
    return recommendations();
  },

  /**
   * @ignore
   */
  _getDefaultSubscriptions: getDefaultSubscriptions,

  /**
   * @ignore
   */
  _setAddonInfo: setAddonInfo,

  /**
   * @ignore
   */
  _resetDefaultAddonInfo: initializeDefaultAddonInfo,

  /**
   * @ignore
   */
  _setFeatureFlags: setFeatureFlags,

  /**
   * @ignore
   */
  _resetFeatureFlags: resetFeatureFlags,

  /**
   * @ignore
   * @param {string} feature
   */
  async _isFeatureEnabled(feature) {
    // The overrides set in tests might only have finished loading from session
    // storage after the call to initializer.start is complete. The values set
    // by an extension when calling EWE.start are available as soon as the
    // addonInfo is set (first step of EWE.start).
    await initializer.start();
    return isFeatureEnabled(feature);
  },

  /**
   * @ignore
   * Clears all subscriptions and filters.
   * @return {Promise} A function that can be called to
   *                    restore the removed subscriptions and filters.
   */
  async _removeAllSubscriptions() {
    for (let subscription of await subs.getSubscriptions()) {
      await subs.remove(subscription.url);
    }

    await removeAllDynamicFilters();
    clearIsDnrSubscriptionUpdating();

    const {filterStorage} = filterEngine;
    filterStorage._clear();
    await filterStorage.saveToDisk();

    filterEngine.clear();
  },

  /**
   * @ignore
   * Call dnrDiffSubscriptionUpdate by subscription URL for testing. It
   * will get an real subscription object before calling the API.
   *
   * @param {string} url The subscription URL.
   * @param {Object} updates The updates to apply.
   */
  async _dnrDiffSubscriptionUpdate(url, updates) {
    await this._waitForInitialization();

    const {filterStorage} = filterEngine;
    let subscription = filterStorage.getSubscription(url);
    // This allow testing if the subscription is not in the storage.
    if (!subscription) {
      subscription = Subscription.fromURL(url);
    }
    await dnrDiffSubscriptionUpdate(subscription, updates);
  },

  getSubscriptionRulesetMap,

  /*
   * @ignore
   * Serialize the result of getDynamicFilters() to an array.
   * @return {Promise} The array.
   */
  async getDynamicFilters() {
    await initPrefs();

    let dynFilters = await getDynamicFilters();
    return Array.from(dynFilters.entries());
  },

  dynamicRulesAvailable,
  testSetDynamicRulesAvailable,

  /**
   * @ignore
   */
  async _clearNotifications() {
    await initPrefs();
    for (let notification of notifications._localNotifications) {
      notifications.removeNotification(notification);
    }

    Prefs.notificationdata = {};
    Prefs.notifications_ignoredcategories = [];
    await awaitSavingComplete();
  },

  enableDebugOutput(enabled) {
    let listener = debugging.ON_REQUEST_CONSOLE_LOGGER.getListener();
    if (enabled) {
      debugging.onLogEvent.addListener(listener);
    }
    else {
      debugging.onLogEvent.removeListener(listener);
    }
  },

  CONSOLE_LOGGER: debugging.logger,

  _log: log,
  _debug: debug,
  _info: info,
  _warn: warn,
  _error: error,
  _trace: trace,

  _clearDebugLog() {
    debugging.ON_REQUEST_CONSOLE_LOGGER.clear();
  },

  _printDebugLog() {
    debugging.ON_REQUEST_CONSOLE_LOGGER.print();
  },

  /**
   * @ignore
   * Removes "patterns.ini" to avoid state leak between the tests.
   * @return {Promise}
   */
  async _clearStorage() {
    await IO.initialize();
    let oldName = FilterStorage.sourceFile;
    let newName = "removed.tmp";
    let stat = await IO.statFile(oldName);

    if (stat.exists) {
      const {filterStorage} = filterEngine;
      await IO.renameFile(oldName, newName);
      filterStorage.clearStats();
      await filterStorage.loadFromDisk();
    }
  },

  async _waitForInitialization() {
    await initializer.start();
  },

  clearIsDnrSubscriptionUpdating,
  isSynchronizing,

  stopTelemetry: telemetry.stop,
  startTelemetry: telemetry.start,
  resetTelemetry: telemetry.reset,

  stopCdpMetricsUploader: cdpMetricsUploader.stop,
  startCdpMetricsUploader: cdpMetricsUploader.start,
  resetCdpMetricsUploader: cdpMetricsUploader.reset,
  setForceEarlyCdpUploads: cdpMetricsUploader2.setForceEarlyUploads,

  stopCdp: cdp.stop,
  startCdp: cdp.start,
  setCdpLoadDelay: cdp.setLoadDelay,
  _setCdpConfig: cdp._setConfig,
  _restoreCdpConfig: cdp._restoreConfig,
  _setCdpData: cdp.setData,
  _getCdpData: cdp.getData,
  _clearCdpData: cdp.clearData,
  _clearCdpActivity: cdp.clearActivity,
  _getCdpDomainStats: cdp.getDomainStats,
  _importRSAPublicKey: cdpEncryption.importRSAPublicKey,
  _requestPublicKey: cdpMetricsUploader3.requestPublicKey,
  _uploadCdp: cdpMetricsUploader3.upload,

  clearSkipInitRulesets,
  checkAndInitSubscriptions,
  _cleanSubscriptionClassesCache,

  // It must be called after frame loading is started,
  // use `await new Page().loaded` for instance.
  async _isContentHelloReceived(tabId, frameId) {
    return !getDeferredMessages(tabId, frameId);
  },

  async _saveSubscriptionMigrationError(subscription, errorMessage) {
    await initializer.start();
    saveSubscriptionMigrationError(subscription, errorMessage);
  },

  async _saveSessionStorage(key, value) {
    let obj = {};
    obj[key] = value;
    await browser.storage.session.set(obj);
  },

  async _removeSessionStorage(keys) {
    await browser.storage.session.remove(keys);
  },

  async getDynamicRules() {
    return await browser.declarativeNetRequest.getDynamicRules();
  },

  _clearFrameState: _clear
};
