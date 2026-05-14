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
  from "#adblockpluscore/lib/subscriptionClasses.js";
import {setRecommendations, recommendations}
  from "#adblockpluscore/lib/recommendations.js";
import {notifications} from "#adblockpluscore/lib/notifications.js";
import {clearKnownFiltersCache} from "#adblockpluscore/lib/filterClasses.js";

import {filterEngine} from "./core.js";
import {Prefs, awaitSavingComplete, init as initPrefs} from "./prefs.js";
import {default as debugging, info, log, debug, warn, error, trace}
  from "./debugging.js";
import {default as subs, saveMigrationError as saveSubscriptionMigrationError,
       getDefaultSubscriptions, isSynchronizing} from "./subscriptions.js";
import {clearSkipInitRulesets, checkAndInitSubscriptions} from "./index.js";
import {default as initializer} from "./initializer.js";
import {setAddonInfo, addonBundledSubscriptionsPath, initializeDefaultAddonInfo}
  from "./info.js";
import {dnrDiffSubscriptionUpdate, dynamicRulesAvailable, getDynamicFilters,
        removeAllDynamicFilters, testSetDynamicRulesAvailable,
        clearIsDnrSubscriptionUpdating}
  from "./dnr-filters.js";
import {getSubscriptionRulesetMap} from "./subscriptions-utils.js";
import {IO} from "./io.js";
import {FilterStorage} from "#adblockpluscore/lib/filterStorage.js";
import * as telemetry from "./telemetry/index.js";
import * as activePing from "./telemetry/active-ping.js";
import * as serverLogUploader from "./telemetry/server-log-uploader.js";
import * as serverLogConfig from "./telemetry/server-log-config.js";
import * as serverLogger from "./telemetry/server-logger.js";
import {clearDedupState, setDedupWindowForTesting, restoreDedupWindow}
  from "./telemetry/snippet-event-dedup.js";
import * as cdpUploader from "./cdp/uploader.js";
import * as filters from "./filters.js";

import * as sitekey from "./sitekey.js";
import {getDeferredMessages} from "./content-message-deferrer.js";
import * as cdp from "./cdp/index.js";
import {_clear} from "./frame-state.js";
import * as account from "./account/index.js";
import * as remoteConfig from "./remote-config/index.js";
import * as cohorts from "./cohorts/index.js";
import * as experiments from "./experiments.js";
import * as sentry from "./sentry.js";
import {hashString} from "../all/hashing.js";
import {logLevelNamesToNumbers} from "../all/telemetry.js";
import {remoteConfigState, setFactsGetter} from "./remote-config/storage.js";
import {MILLIS_IN_DAY, MILLIS_IN_HOUR} from "../../adblockpluscore/lib/time.js";

const serverLoggerInstance = new telemetry.default.ServerLogger("test_ewe_background");
const altServerLoggerInstance = new telemetry.default.ServerLogger("test_ewe_ui_api");

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
   * Clears known filters cache. This is necessary when filter generation is
   * non-deterministic (e.g. if the exact same filter text leads to a different
   * filter object depending on whether a feature flags is set).
   */
  clearKnownFiltersCache,

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

  stopTelemetry: activePing.stop,
  startTelemetry: activePing.start,
  resetTelemetry: activePing.reset,

  startServerLogUploader: serverLogUploader.start,
  stopServerLogUploader: serverLogUploader.stop,
  resetServerLogUploader: serverLogUploader.reset,
  serverLogUploaderIsRunning: serverLogUploader.isRunning,

  setRotatingClientId: serverLogConfig.setRotatingClientId,
  resetRotationPeriod: serverLogConfig.resetRotationPeriod,
  setRotationPeriod: serverLogConfig.setRotationPeriod,

  stopCdpMetricsUploader: cdpUploader.stop,
  startCdpMetricsUploader: cdpUploader.start,
  resetCdpMetricsUploader: cdpUploader.reset,

  stopCdp: cdp.stop,
  startCdp: cdp.start,
  setCdpLoadDelay: cdp.setLoadDelay,
  _setCdpConfig: cdp._setConfig,
  _restoreCdpConfig: cdp._restoreConfig,
  _setCdpData: cdp.setData,
  _setCdpDataArray: cdp.setDataArray,
  _getCdpData: cdp.getData,
  _clearCdpData: cdp.clearData,
  _countWallDetectionEvent: cdp.countWallDetectionEvent,
  getCdpWallDetectionState: cdp.getWallDetectionState,

  // Simulates the full background message-handler path for a snippet detection
  // event: increments both the CDP wall-detection counter (ds "w" metric) and
  // the behaviour-log counter (es path). Use this in functional tests where the
  // log-if-* snippets (which live in abp-snippets, not @eyeo/snippets) are not
  // available in the test environment.
  _simulateSnippetDetectionEvent(type, domain) {
    const keySuffix = `${type}:${domain}`;
    cdp.countWallDetectionEvent(domain);
    serverLogger.serverLogValidatedEvent(
      Date.now(),
      "detection_snippets",
      logLevelNamesToNumbers.behavior,
      "snippet_detection_event",
      {type, domain, specifier: null},
      keySuffix
    );
  },
  _simulateSnippetHitEvent(filter, domain, topLevelDomain) {
    const effectiveTopLevel = topLevelDomain || domain;
    const keySuffix = `${filter}:${domain}:${effectiveTopLevel}`;
    serverLogger.serverLogValidatedEvent(
      Date.now(),
      "hit_snippets",
      logLevelNamesToNumbers.behavior,
      "snippet_hit_event",
      {filter, domain, topLevelDomain: effectiveTopLevel},
      keySuffix
    );
  },
  _clearSnippetEventDedupState: clearDedupState,
  _setDedupWindowForTesting: setDedupWindowForTesting,
  _restoreDedupWindow: restoreDedupWindow,
  _clearCdpActivity: cdp.clearActivity,
  _buildCdpStatsPayload: cdpUploader.buildStatsPayload,
  _isCdpOptedOut: cdp.isOptedOut,
  _requestPublicKey: cdpUploader.requestPublicKey,
  _uploadCdp: cdpUploader.upload,

  clearSkipInitRulesets,
  checkAndInitSubscriptions,
  _cleanSubscriptionClassesCache,

  removeTabExpirationFilters: filters.removeTabExpirationFilters,

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

  _clearFrameState: _clear,

  // remote config
  restartRemoteConfig(url, syncInterval, errorRetryDelay, disableAutosync) {
    remoteConfig.stop();
    remoteConfig.start({url, syncInterval, errorRetryDelay, disableAutosync});
  },
  resetRemoteConfig: remoteConfig.reset,
  async mockRemoteConfig(config, countryCode = "US") {
    const state = await remoteConfigState.getStateLoaded();

    state.revisionId = await hashString(JSON.stringify(config));
    state.countryCode = countryCode;
    state.rawData = config;
    state.etag = "";
    state.lastDownloaded = new Date().getTime();
    state.errors = [];

    await remoteConfigState.save();
  },

  async stopAccount() {
    await account.stop();
  },
  async clearAccountStorage() {
    await account.clearAccountStorage();
  },
  async restartAccount({
    apiBaseUrl,
    applicationId,
    loginRequestPattern,
    profileSyncConfig = {
      syncInterval: MILLIS_IN_DAY,
      errorRetryDelay: MILLIS_IN_HOUR,
      disableAutosync: false
    }
  }) {
    await account.start({
      apiBaseUrl,
      applicationId,
      loginRequestPattern,
      profileSyncConfig
    });
  },

  // cohorts
  resetCohortsData: cohorts.reset,
  mockFacts(facts) {
    setFactsGetter(() => facts);
  },

  // experiments
  setExperimentsSeed: experiments.setSeed,
  resetExperimentData: experiments.reset,

  // sentry
  getLastSentryEvent: sentry.getLastEvent,
  setSentrySampleRate: sentry.setSampleRate,

  serverLogger: {
    debug(event, data) {
      serverLoggerInstance.debug(event, data);
    },

    info(event, data) {
      serverLoggerInstance.info(event, data);
    },

    behavior(event, data, ipmId) {
      serverLoggerInstance.behavior(event, data, ipmId);
    },

    warn(event, data) {
      serverLoggerInstance.warn(event, data);
    }
  },

  altServerLogger: {
    debug(event, data) {
      altServerLoggerInstance.debug(event, data);
    },

    info(event, data) {
      altServerLoggerInstance.info(event, data);
    },

    behavior(event, data, ipmId) {
      altServerLoggerInstance.behavior(event, data, ipmId);
    },

    warn(event, data) {
      altServerLoggerInstance.warn(event, data);
    }
  },

  /**
   * Gets the current behaviour logging state with call counts
   * @returns {Promise<Object>} Object with event names as keys and counts
   *   as values
   */
  async getBehaviourLoggingState() {
    return serverLogger.getBehaviourLoggingState();
  },

  /**
   * Clears the behaviour logging state
   * @returns {Promise<void>}
   */
  async clearBehaviourLoggingState() {
    return serverLogger.clearBehaviourLoggingState();
  }
};
