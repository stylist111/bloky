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

import {validate as validateSubscriptions} from "./subscriptions-validator.js";
import {rulesetExistsInManifest, getFilterText} from "./subscriptions-utils.js";
import {Subscription, CountableSubscription, RegularSubscription,
        FullUpdatableSubscription, SpecialSubscription,
        DiffUpdatableSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {recommendations} from "adblockpluscore/lib/recommendations.js";
import {Filter} from "adblockpluscore/lib/filterClasses.js";

import {addonBundledSubscriptions} from "./info.js";
import {default as initializer} from "./initializer.js";
import {filterEngine} from "./core.js";
import {EventDispatcher} from "./types.js";
import {convertFilter} from "./filters.js";
import {disableDynamicRules, isDnrSubscriptionUpdating} from "./dnr-filters.js";

import {Prefs} from "./prefs.js";

const ACCEPTABLE_ADS_ID = "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F";
const ACCEPTABLE_ADS_MV2_URL = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
const ACCEPTABLE_ADS_MV3_URL = "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

const ACCEPTABLE_ADS_PRIVACY_ID = "F12E0801-A00B-49DE-B1E3-52C9C4F90C8C";
const ACCEPTABLE_ADS_PRIVACY_MV2_URL = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
const ACCEPTABLE_ADS_PRIVACY_MV3_URL = "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules-privacy-friendly.txt";

function convertSubscription(subscription) {
  const {
    id, disabled, downloadStatus, homepage, version, lastDownload, lastSuccess,
    softExpiration, expires, title, url, downloadable, downloadCount, diffURL,
    privileged, lastModified} = subscription;

  let updatable = (subscription instanceof FullUpdatableSubscription ||
                   subscription instanceof DiffUpdatableSubscription);

  return {
    id,
    enabled: !disabled,
    privileged,
    homepage,
    downloadable,
    updatable,
    diffURL,
    title,
    url,
    downloadCount,
    version,
    downloading: isSynchronizing(url),
    downloadStatus,
    lastSuccess,
    lastDownload,
    softExpiration,
    expires,
    lastModified
  };
}

function convertRecommendation({id, languages, title, requires, type, url,
                                mv2URL}) {
  if (!browser.declarativeNetRequest) {
    // In MV2 we have to switch the URL to be the mv2URL
    return {id, languages, title, requires, type, url: mv2URL};
  }

  return {id, languages, title, requires, type, url, mv2URL};
}

function getSubscription(url) {
  let subscription = Subscription.fromURL(url);

  if (filterEngine.filterStorage.hasSubscription(subscription) &&
      subscription instanceof RegularSubscription) {
    return subscription;
  }

  return null;
}

function makeListener(dispatch) {
  return subscription => {
    if (subscription instanceof RegularSubscription) {
      dispatch(convertSubscription(subscription));
    }
  };
}

/**
 * @ignore
 */
export async function hasAcceptableAdsEnabled() {
  const matches = [ACCEPTABLE_ADS_MV2_URL,
                   ACCEPTABLE_ADS_MV3_URL,
                   ACCEPTABLE_ADS_PRIVACY_MV2_URL,
                   ACCEPTABLE_ADS_PRIVACY_MV3_URL];

  for (let subscription of await getSubscriptions()) {
    if (subscription.enabled && matches.includes(subscription.url)) {
      return true;
    }
  }

  return false;
}

/**
 * @ignore
 * @param {string} uiLanguage UI language
 * @returns {{
*   chosenSubscriptions: Subscription[],
*   hasAA: boolean,
*   hasAntiCV: boolean,
*   hasCurrentLang: boolean,
*   hasDefaultLang: boolean
* }}
 */
export function getDefaultSubscriptions(uiLanguage) {
  let hasCurrentLang = false;
  let hasDefaultLang = false;
  let hasAA = false;
  let hasAntiCV = false;

  if (!uiLanguage) {
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1159438
    if (browser.i18n.getUILanguage) {
      uiLanguage = browser.i18n.getUILanguage();
    }
    else {
      uiLanguage = navigator.language;
    }
  }

  let currentLang = uiLanguage.split("-")[0];
  let defaultLang = (browser.runtime.getManifest()
                                    .default_locale || "en").split("_")[0];

  let adSubscriptions = [];
  let adSubscriptionsDefaultLang = [];
  let aaSubscriptions = [];
  let chosenSubscriptions = [];

  for (let subscription of recommendations()) {
    switch (subscription.type) {
      case "ads":
        if (subscription.languages.includes(currentLang)){
          hasCurrentLang = true;
          adSubscriptions.push(subscription);
        }

        if (subscription.languages.includes(defaultLang)) {
          hasDefaultLang = true;
          adSubscriptionsDefaultLang.push(subscription);
        }
        break;

      case "circumvention":
        chosenSubscriptions.push(subscription);
        hasAntiCV = true;
        break;

      case "allowing":
        aaSubscriptions.push(subscription);
        hasAA = true;
        break;
    }
  }

  if (adSubscriptions.length == 0) {
    adSubscriptions = adSubscriptionsDefaultLang;
  }

  // if we have the preferred AA in the list - use it only,
  // otherwise use all listed AA subscriptions
  let preferredAASubscription = aaSubscriptions.find(
    it => it.id == ACCEPTABLE_ADS_ID);
  if (preferredAASubscription) {
    aaSubscriptions = [preferredAASubscription];
  }
  chosenSubscriptions.unshift(...aaSubscriptions);

  chosenSubscriptions.unshift(...adSubscriptions);

  return {chosenSubscriptions, hasAA, hasAntiCV,
          hasCurrentLang, hasDefaultLang};
}

function shouldAddDefaultSubscriptions() {
  let {filterStorage} = filterEngine;
  for (let subscription of filterStorage.subscriptions()) {
    if (browser.declarativeNetRequest) {
      // `DiffUpdatableSubscription` is a subclass of `CountableSubscription`
      if (subscription instanceof CountableSubscription) {
        return false;
      }
    }

    if (subscription instanceof FullUpdatableSubscription &&
      subscription.url != ACCEPTABLE_ADS_MV2_URL) {
      return false;
    }

    if (subscription instanceof SpecialSubscription &&
        subscription.filterCount > 0) {
      return false;
    }
  }

  return true;
}

async function enableRuleset(rulesetId) {
  if (browser.declarativeNetRequest) {
    if (rulesetExistsInManifest(rulesetId)) {
      await browser.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [rulesetId]
      });
    }
  }
}

async function disableRuleset(rulesetId) {
  if (browser.declarativeNetRequest && rulesetExistsInManifest(rulesetId)) {
    await browser.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: [rulesetId]
    });

    await disableDynamicRules(rulesetId);

    let enableRuleIds =
      await browser.declarativeNetRequest.getDisabledRuleIds({
        rulesetId
      });
    await browser.declarativeNetRequest.updateStaticRules({
      rulesetId,
      enableRuleIds
    });
  }
}

/**
 * @ignore
 * @param {Array<*>} bundledSubscriptions Bundled subscriptions
 * @param {String} bundledSubscriptionsPath Bundled subscriptions path
 */
export async function validate(bundledSubscriptions,
                               bundledSubscriptionsPath) {
  return validateSubscriptions(
    bundledSubscriptions, bundledSubscriptionsPath);
}

async function remove(url) {
  let subscription = getSubscription(url);

  if (!subscription) {
    throw new Error(`Subscription does not exist: ${url}`);
  }

  if (browser.declarativeNetRequest) {
    if (subscription instanceof FullUpdatableSubscription) {
      await disableDynamicRules(subscription.url);
    }
    else {
      await disableRuleset(subscription.id);
    }
  }

  filterEngine.filterStorage.removeSubscription(subscription);
}

async function migrateSubscriptionToMv3(subscription) {
  let subscriptionInfo = addonBundledSubscriptions.find(
    it => it.mv2_url == subscription.url);
  let url = subscriptionInfo ? subscriptionInfo.url : subscription.url;
  await add(url, {
    downloadCount: subscription.downloadCount,
    version: subscription.version
  });
  if (!subscription.enabled) {
    await disable(url);
  }
}

/**
 * @ignore
 */
export async function recoverMigrationErrorSubscriptions() {
  let sucessfullyRecoveredIndices = [];

  let errors = Prefs.migration_subscription_errors;

  if (!Array.isArray(errors)) {
    errors = [];
  }

  for (let i = 0; i < errors.length; i++) {
    let migrationError = errors[i];

    try {
      await migrateSubscriptionToMv3(migrationError.subscription);
      sucessfullyRecoveredIndices.push(i);
    }
    catch (e) {
      // Nothing extra to do here. We just weren't able to recover this one.
    }
  }

  if (sucessfullyRecoveredIndices.length > 0) {
    errors = errors.filter((_e, index) =>
      !sucessfullyRecoveredIndices.includes(index));
    Prefs.migration_subscription_errors = errors;
  }
}

/**
 * @ignore
 */
export async function updateSubscriptionInformation() {
  let removeUrls = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof RegularSubscription) {
      let subscriptionInfo = addonBundledSubscriptions.find(
        x => x.url == subscription.url);

      if (subscription.hasBundledFilters) {
        if (subscriptionInfo) {
          // Existing bundled subscription, after the update it's still a
          // bundled subscription.

          try {
            let {filterText} = await getFilterText(subscriptionInfo);
            subscription.setFilterText(filterText);
          }
          catch (e) {
            // We already warn if the file doesn't exist on startup, so
            // we can ignore an error loading the bundled file here.
          }

          subscription.diffURL = subscriptionInfo.diff_url;
          subscription.title = subscriptionInfo.title;
          subscription.homepage = subscriptionInfo.homepage;
        }
        else {
          // Existing bundled subscription, but after the update it's been
          // removed from the extension's bundled subscriptions.

          removeUrls.push(subscription.url);
        }
      }
      else if (subscriptionInfo) {
        // Existing custom user subscription, after the update it's now bundled
        // so we should migrate to the bundled one.

        await remove(subscription.url);
        await add(subscriptionInfo.url, {
          downloadCount: subscription.downloadCount,
          version: subscription.version
        });
        if (!subscription.enabled) {
          await disable(subscriptionInfo.url);
        }
      }
    }
  }

  for (let url of removeUrls) {
    await remove(url);
  }
}

function getSubscriptions() {
  let result = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof RegularSubscription) {
      result.push(convertSubscription(subscription));
    }
  }

  return result;
}

/**
 * @ignore
 * @param {boolean} url Is synchronizing for passed URL?
 * @returns {boolean}
 */
export function isSynchronizing(url) {
  return filterEngine.filterStorage.synchronizer
    .isExecuting(url) || isDnrSubscriptionUpdating(url);
}

async function add(url, properties = {}) {
  if (!Subscription.isValidURL(url)) {
    throw new Error(`Invalid subscription URL provided: ${url}`);
  }

  let {filterStorage} = filterEngine;

  let subscription = Subscription.fromURL(url);

  if (browser.declarativeNetRequest && !subscription.downloadable) {
    let subscriptionInfo = addonBundledSubscriptions.find(x => x.url == url);
    let filterText;
    let params;
    try {
      ({filterText, params} = await getFilterText(subscriptionInfo));
    }
    catch (e) {
      // We already warn if the file doesn't exist on startup, so
      // we can ignore an error loading the bundled file here.
    }

    if (filterText) {
      subscription.setFilterText(filterText);
    }

    if (params) {
      subscription.setParams(params);
    }
  }

  if ("title" in properties) {
    subscription.title = properties.title;
  }
  if ("homepage" in properties) {
    subscription.homepage = properties.homepage;
  }
  if ("downloadCount" in properties) {
    subscription.downloadCount = properties.downloadCount;
  }
  if ("version" in properties) {
    subscription.version = properties.version;
  }
  if ("lastDownload" in properties) {
    subscription.lastDownload = properties.lastDownload;
  }
  if ("privileged" in properties) {
    subscription.privileged = properties.privileged;
  }
  if ("diffURL" in properties) {
    subscription.diffURL = properties.diffURL;
  }
  if ("lastModified" in properties) {
    subscription.lastModified = properties.lastModified;
  }

  filterStorage.addSubscription(subscription);

  if (browser.declarativeNetRequest && !subscription.downloadable) {
    await enableRuleset(subscription.id);
  }

  if (!subscription.lastDownload &&
      !isSynchronizing(subscription.url)) {
    filterStorage.synchronizer.execute(subscription);
  }
}

async function disable(url) {
  let subscription = getSubscription(url);

  if (!subscription) {
    throw new Error(`Subscription does not exist: ${url}`);
  }

  subscription.disabled = true;

  if (browser.declarativeNetRequest) {
    if (subscription instanceof FullUpdatableSubscription) {
      await disableDynamicRules(subscription.url);
    }
    else {
      await disableRuleset(subscription.id);
    }
  }
}

function migrationNeeded() {
  if (browser.runtime.getManifest().manifest_version == 2) {
    return false;
  }

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription.downloadable) {
      return true;
    }
  }

  return false;
}

/**
 * @ignore
 * @param {Subscription} subscription
 * @param {string} error
 */
export function saveMigrationError(subscription, error) {
  let errors = Prefs.migration_subscription_errors;
  errors.push({subscription, error});
  Prefs.migration_subscription_errors = errors;
}

/**
 * @ignore
 */
export async function migrate() {
  await initializer.start();

  if (!migrationNeeded()) {
    return;
  }

  let downloadables = await getSubscriptions();
  for (let downloadable of downloadables) {
    // some subscriptions are already `CountableSubscription`,
    // that were migrated from MV2 to MV3 without diff updated.
    if (!downloadable.downloadable) {
      continue;
    }

    await remove(downloadable.url); // MV2 URL
    try {
      migrateSubscriptionToMv3(downloadable);
    }
    catch (e) {
      saveMigrationError(downloadable, e.message);
    }
  }
}

/**
 * @ignore
 */
export async function ensureDNRRulesetsEnabled() {
  if (browser.declarativeNetRequest) {
    let enabledItems = await browser.declarativeNetRequest.getEnabledRulesets();

    for (let subscription of filterEngine.filterStorage.subscriptions()) {
      if (!enabledItems.includes(subscription.id) && !subscription.disabled) {
        enableRuleset(subscription.id);
      }
    }
  }
}

export default {
  /**
   * The URL of the Acceptable Ads subscription.
   * @type {string}
   */
  get ACCEPTABLE_ADS_URL() {
    return browser.declarativeNetRequest ?
      ACCEPTABLE_ADS_MV3_URL :
      ACCEPTABLE_ADS_MV2_URL;
  },

  /**
   * The UUID of the Acceptable Ads subscription.
   * @type {string}
   */
  ACCEPTABLE_ADS_ID,

  /**
   * The URL of the Acceptable Ads
   * without third-party tracking subscription.
   * @type {string}
   */
  get ACCEPTABLE_ADS_PRIVACY_URL() {
    return browser.declarativeNetRequest ?
      ACCEPTABLE_ADS_PRIVACY_MV3_URL :
      ACCEPTABLE_ADS_PRIVACY_MV2_URL;
  },

  /**
   * The UUID of the Acceptable Ads without third-party tracking subscription.
   * @type {string}
   */
  ACCEPTABLE_ADS_PRIVACY_ID,

  /**
   * A resource that provides a list of filters that decide what to block.
   * @typedef {Object} Subscription
   * @property {boolean} downloadable Indicates whether this subscription is
   *                                  downloaded and updated with full update
   *                                  over the network.
   * @property {boolean} updatable Indicates whether this subscription can be
   *                               updated with either full or diff update
   *                               over the network.
   * @property {?string} diffURL The URL of diff updates endpoint for
   *                             DiffUpdatableSubscriptions in MV3.
   * @property {?boolean} downloading Indicates whether the subscription is
   *                                  currently downloading (updatable
   *                                  subscriptions only).
   * @property {?string} downloadStatus The status of the most recent download
   *   attempt (updatable subscriptions only). It can have the following values:
   * - `synchronize_ok` - The subscription is perfectly fine.
   * - `synchronize_connection_error` - An error has occurred when trying to
   *   download the subscription.
   * - `synchronize_invalid_url` - The subscription URL is invalid.
   * - `synchronize_invalid_data` - The downloaded data does not have the
   *   expected format.
   * - `synchronize_too_many_filters` - A custom user subscription cannot
   *   update because there aren't enough dynamic rules available.
   * - `synchronize_dnr_error` - Downloading succeeded but, an error occurred
   *   while updating the custom subscription.
   * - `synchronize_diff_too_many_filters` - A diff updatable subscription
   *   cannot update because there aren't enough dynamic rules available.
   * - `synchronize_diff_too_old` - An error occurred when trying to download
   *   the diffs. The bundled subscription is too old.
   * - `synchronize_diff_error` - Downloading succeeded but, an error occurred
   *   while updating the diff updatable subscription.
   * - null - The initial download is not completed yet, or the subscription is
   *   not updatable.
   * @property {boolean} enabled Indicates whether this subscription will
   *                             be applied.
   * @property {?number} expires Epoch time when the subscription must be
   *                             downloaded (downloadable subscriptions
   *                             only).
   * @property {?string} homepage Website of the project that manages
   *                              this filter list.
   * @property {?number} lastDownload Epoch time when the subscription
   *                                  was last downloaded to your machine
   *                                  (downloadable subscriptions only).
   * @property {?string} lastModified String representation of the date when the
   *                                  filter list was last modified. In case of
   *                                  a DiffUpdatableSubscription, it is the
   *                                  base date used to calculate the diffs.
   * @property {?number} lastSuccess Epoch time when this subscription was last
   *                                 successfully downloaded (downloadable
   *                                 subscriptions only).
   * @property {?boolean} privileged True if this subscription can load filters
   *                                 that require privileged access, like
   *                                 snippets.
   * @property {?number} softExpiration Epoch time for the next attempt to
   *                                    download the subscription. Can be
   *                                    updated even if the subscription was
   *                                    not downloaded. If `expires` is closer,
   *                                    then `expires` prevail. (downloadable
   *                                    subscriptions only).
   * @property {string} title The display name of the subscription.
   *                          If not provided, falls back to the URL.
   * @property {string} url Where the subscription can be found in plain text.
   *                        Used a the identifier.
   * @property {string} version The version provided by the subscription's
   *                            metadata. Defaults to '0' if not provided. It
   *                            might be set if the subscription is not
   *                            downloadable.
   */

  /**
   * Creates a new subscription from a given URL. The subscription also gets
   * synchronised if it had not been previously downloaded.
   * @param {string} url The URL of the subscription to be added.
   * @param {object} [properties] An object containing properties to be
   *                              set on the new subscription.
   * @param {string} [properties.title] The display name of the subscription.
   *                                    If not provided, falls back to the URL.
   * @param {string} [properties.homepage] Website of the project that
   *                                       manages this filter list.
   * @param {boolean} [properties.privileged] Whether or not this subscription
   *                                          is allowed to run snippets.
   * @return {Promise}
   * @throws {Error} Invalid subscription URL provided.
   */
  add,

  /**
   * Adds a list of default subscriptions based on the provided bundled
   * subscriptions from the EWE.start() call.
   * Subscriptions are selected based on relevant language, type of
   * circumvention, and type of allowing.
   * @param {string} [uiLanguage] The relevant language used for determining
   * which subscriptions to add. If omitted or null, browser.i18n.getUILanguage
   * will be used. If browser.i18n.getUILanguage is unavailable,
   * navigator.language is used.
   * @param {bool} [force = false]
   * @throws {Error} No default language subscription
   * @throws {Error} No anti-circumvention subscription
   * @throws {Error} No allowing subscription
   * @see {@link #start|start()}
   * @return {Promise}
   */
  async addDefaults(uiLanguage, force = false) {
    let subscriptions = [];

    if (force || shouldAddDefaultSubscriptions()) {
      let defaultSubscriptions = getDefaultSubscriptions(uiLanguage);
      if (!defaultSubscriptions.hasDefaultLang) {
        throw Error("No default language subscription");
      }

      if (!defaultSubscriptions.hasAntiCV) {
        throw Error("No anti-circumvention subscription");
      }

      if (!defaultSubscriptions.hasAA) {
        throw Error("No allowing subscription");
      }

      subscriptions.push(...defaultSubscriptions.chosenSubscriptions);
    }

    for (let subscription of subscriptions) {
      await this.add(browser.declarativeNetRequest ?
        subscription.url : subscription.mv2URL);
    }
  },

  /**
   * Returns an array of subscription objects for all subscriptions that are
   * downloaded and updated over the network.
   * @return {Promise<Array<Subscription>>}
   * @deprecated Use {@link #getSubscriptions|getSubscriptions()} instead
   */
  async getDownloadable() {
    const subscriptions = getSubscriptions();
    return subscriptions.map(each => {
      delete each.updatable; // newly introduced
      return each;
    });
  },

  /**
   * Returns an array of subscription objects for all subscriptions that are
   * downloaded and updated over the network.
   * @return {Promise<Array<Subscription>>}
   */
  async getSubscriptions() {
    const subscriptions = getSubscriptions();
    return subscriptions.map(each => {
      delete each.downloadable; // deprecated
      return each;
    });
  },

  /**
   * Returns an array of subscription objects for a given filter.
   * @param {string} text The filter rule for which to look.
   * @return {Promise<Array<Subscription>>}
   */
  async getForFilter(text) {
    return text ? Array.from(filterEngine.filterStorage.subscriptions(text),
                             convertSubscription) : [];
  },

  /**
   * Returns the filter list of a given subscription URL.
   * @param {string} url The URL of the subscription.
   * @return {Promise<Array<Filter>>} Filters from the subscription.
   */
  async getFilters(url) {
    let subscription = getSubscription(url);
    if (subscription) {
      return Array.from(subscription.filterText(),
                        text => convertFilter(Filter.fromText(text)));
    }

    return [];
  },

  /**
   * Checks if a subscription has been added.
   * @param {string} url The URL of the subscription to be checked.
   * @return {Promise<boolean>} True if a subscription has been added.
   * @throws {TypeError} Invalid URL provided.
   */
  async has(url) {
    return getSubscription(new URL(url).href) != null;
  },

  /**
   * Enables a previously disabled subscription. Has no effect otherwise.
   * @param {string} url The URL of the subscription to be enabled.
   * @return {Promise}
   * @throws {Error} Subscription does not exist.
   */
  async enable(url) {
    let subscription = getSubscription(url);

    if (!subscription) {
      throw new Error(`Subscription does not exist: ${url}`);
    }

    if (browser.declarativeNetRequest) {
      await enableRuleset(subscription.id);
    }

    // Note: we must mark the subscription as enabled after
    // we actually finish with the restoring of dynamic rules
    // as marking subscription as enabled triggers the subscription update,
    // and the diff update processing which includes dynamic rules operations
    // can happen in parallel with restoring of dynamic rules here.
    subscription.disabled = false;
  },

  /**
   * Disables a subscription so that it doesn't have any
   * effect until it gets enabled again.
   * @param {string} url The URL of the subscription to be disabled.
   * @return {Promise}
   * @throws {Error} Subscription does not exist.
   */
  disable,

  /**
   * Removes the subscription for the given URL.
   * It will no longer have any effect.
   * @param {string} url The URL of the subscription to be removed.
   * @return {Promise}
   * @throws {Error} Subscription does not exist.
   */
  remove,

  /**
   * Forces a new version of a subscription with the
   * given URL to be downloaded immediately.
   * @param {?string} [url] The URL of the subscription to be synchronized.
   *   If omitted, all subscriptions will be synchronized.
   * @return {Promise} Resolves when syncing has been successfully
   *   triggered. Syncing may not be completed when this promise
   *   resolves.
   * @throws {Error} Subscription does not exist.
   */
  async sync(url) {
    let subscriptions = [];
    let {filterStorage} = filterEngine;

    if (url) {
      let subscription = getSubscription(url);

      if (!subscription) {
        throw new Error(`Subscription does not exist: ${url}`);
      }

      subscriptions.push(subscription);
    }
    else {
      for (let subscription of filterStorage.subscriptions()) {
        if (subscription instanceof RegularSubscription) {
          subscriptions.push(subscription);
        }
      }
    }
    for (let subscription of subscriptions) {
      if (!isSynchronizing(subscription.url)) {
        filterStorage.synchronizer.execute(subscription, true);
      }
    }
  },

  /**
   * Defines the recommended filter subscriptions per language.
   * @typedef {Object} Recommendation
   * @property {string} id The identifier for this subscription.
   * @property {Array<string>} languages The languages that this recommendation
   *                                      would match to.
   * @property {string} title The display name of the recommended subscription.
   * @property {Array<string>} requires A list of subscriptions that this
   *                                    one depends on.
   * @property {Array<string>} includes A list of subscriptions that this
   *                                    one also contains.
   * @property {?boolean} privileged True if this subscription can load filters
   *                                 that require privileged access, like
   *                                 snippets.
   * @property {string} type The kind of content targeted by this
   *                         recommended subscription.
   * @property {string} url Where the recommended subscription can be found
   *                        in plain text.
   * @property {?string} mv2URL Where the recommended subscription can be found
   *                            for MV2 in plain text (Manifest V3 only).
   */

  /**
   * Returns an array of all recommended subscriptions.
   * @return {Array<Recommendation>}
   */
  getRecommendations() {
    return Array.from(recommendations(), convertRecommendation);
  },

  /**
   * Returns an array of MV2 to MV3 migration errors and the related
   * subscription.
   * @return {Promise<Array<Subscription, string>>} The migration errors.
   */
  async getMigrationErrors() {
    let errors = Prefs.migration_subscription_errors;

    if (!Array.isArray(errors)) {
      errors = [];
    }

    return errors;
  },

  /**
   * Clears the migration errors.
   * @return {Promise}
   */
  async clearMigrationErrors() {
    Prefs.migration_subscription_errors = [];
  },

  /**
   * Emitted when a new subscription is added.
   * @event
   * @type {EventDispatcher<Subscription>}
   */
  onAdded: new EventDispatcher(dispatch => {
    filterNotifier.on("subscription.added", makeListener(dispatch));
  }),

  /**
   * Emitted when any property of the subscription has changed.
   * The name of the specific property is provided as a string, except
   * when the subscription has been updated, where it will be null.
   *
   * @event
   * @type {EventDispatcher<Subscription, string>}
   */
  onChanged: new EventDispatcher(dispatch => {
    function makeChangeListener(property) {
      // This name differs between EWE and adblockpluscore.
      if (property == "disabled") {
        property = "enabled";
      }

      return subscription => {
        // the subscription might be already removed,
        // so we might need to skip emitting events
        if ((subscription instanceof RegularSubscription) &&
             getSubscription(subscription.url)) {
          dispatch(convertSubscription(subscription), property);
        }
      };
    }

    let properties = ["disabled", "title", "homepage", "lastDownload",
                      "downloadStatus", "downloading", "privileged",
                      "lastModified"];
    for (let property of properties) {
      filterNotifier.on(`subscription.${property}`,
                        makeChangeListener(property));
    }

    filterNotifier.on("subscription.updated", makeChangeListener(null));
  }),

  /**
   * Emitted when a subscription is removed.
   * @event
   * @type {EventDispatcher<Subscription>}
   */
  onRemoved: new EventDispatcher(dispatch => {
    filterNotifier.on("subscription.removed", makeListener(dispatch));
  })
};
