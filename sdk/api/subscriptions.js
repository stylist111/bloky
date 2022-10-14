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

import {Subscription, DownloadableSubscription, RegularSubscription,
        SpecialSubscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {recommendations} from "adblockpluscore/lib/recommendations.js";
import {Filter} from "adblockpluscore/lib/filterClasses.js";
import {parseFilterList} from "adblockpluscore/lib/filters/lists.js";

import {addonBundledSubscriptions, addonBundledSubscriptionsPath}
  from "./info.js";
import {default as initializer} from "./initializer.js";
import {filterEngine} from "./core.js";
import {EventDispatcher} from "./types.js";
import {convertFilter} from "./filters.js";

import {readFileContent} from "./io.js";
import {Prefs} from "./prefs.js";

const ACCEPTABLE_ADS_ID = "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F";
const ACCEPTABLE_ADS_MV2_URL = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
const ACCEPTABLE_ADS_MV3_URL = "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

const ACCEPTABLE_ADS_PRIVACY_ID = "F12E0801-A00B-49DE-B1E3-52C9C4F90C8C";
const ACCEPTABLE_ADS_PRIVACY_MV2_URL = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
const ACCEPTABLE_ADS_PRIVACY_MV3_URL = "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules-privacy-friendly.txt";

function convertSubscription(subscription) {
  let {id, disabled, downloadStatus, homepage,
       version, lastDownload, lastSuccess,
       softExpiration, expires, title, url,
       downloadable, downloadCount} = subscription;
  let {synchronizer} = filterEngine.filterStorage;

  return {
    id, enabled: !disabled,
    downloading: synchronizer.isExecuting(url),
    downloadStatus, homepage, version, lastDownload, lastSuccess,
    softExpiration, expires, title, url, downloadable, downloadCount
  };
}

function convertRecommendation({id, languages, title, requires, type, url,
                                // eslint-disable-next-line camelcase
                                mv2URL}) {
  return {id, languages, title, requires, type, url, mv2URL};
}

function getSubscription(url) {
  let subscription = Subscription.fromURL(url);

  if (filterEngine.filterStorage.hasSubscription(subscription) &&
      subscription instanceof RegularSubscription)
    return subscription;

  return null;
}

function makeListener(dispatch) {
  return subscription => {
    if (subscription instanceof RegularSubscription)
      dispatch(convertSubscription(subscription));
  };
}

export function getDefaultSubscriptions(uiLanguage) {
  let hasCurrentLang = false;
  let hasDefaultLang = false;
  let hasAA = false;
  let hasAntiCV = false;

  if (!uiLanguage) {
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1159438
    if (browser.i18n.getUILanguage)
      uiLanguage = browser.i18n.getUILanguage();
    else
      uiLanguage = navigator.language;
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

  if (adSubscriptions.length == 0)
    adSubscriptions = adSubscriptionsDefaultLang;

  // if we have the preferred AA in the list - use it only,
  // otherwise use all listed AA subscriptions
  let preferredAASubscription = aaSubscriptions.find(
    it => it.id == ACCEPTABLE_ADS_ID);
  if (preferredAASubscription)
    aaSubscriptions = [preferredAASubscription];
  chosenSubscriptions.unshift(...aaSubscriptions);

  chosenSubscriptions.unshift(...adSubscriptions);

  return {chosenSubscriptions, hasAA, hasAntiCV,
          hasCurrentLang, hasDefaultLang};
}

function shouldAddDefaultSubscriptions() {
  let {filterStorage} = filterEngine;
  for (let subscription of filterStorage.subscriptions()) {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != ACCEPTABLE_ADS_MV2_URL &&
        subscription.type != "circumvention")
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filterCount > 0)
      return false;
  }

  return true;
}

async function enableRuleset(rulesetId) {
  if (browser.declarativeNetRequest && rulesetExistsInManifest(rulesetId)) {
    await browser.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [rulesetId]
    });
  }
}

async function disableRuleset(rulesetId) {
  if (browser.declarativeNetRequest && rulesetExistsInManifest(rulesetId)) {
    await browser.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: [rulesetId]
    });
  }
}

async function getFilterText(subscription, path) {
  let subscriptionPath = `${path}/${subscription.id}`;
  let rawLines = (await readFileContent(subscriptionPath));
  let {lines, error} = parseFilterList(rawLines);
  if (error)
    throw new Error(error);
  if (!lines)
    throw new Error("invalid filter list");
  lines.shift();
  return lines;
}

async function subscriptionFileExists(subscription, path) {
  let subscriptionPath = `${path}/${subscription.id}`;
  const url = browser.runtime.getURL(subscriptionPath);
  try {
    const fetchResult = await fetch(url, {method: "HEAD"});
    return fetchResult.ok;
  }
  catch (error) {
    return false;
  }
}

function rulesetExistsInManifest(rulesetId) {
  let manifest = browser.runtime.getManifest();

  return manifest.declarative_net_request &&
    manifest.declarative_net_request.rule_resources &&
    manifest.declarative_net_request.rule_resources.find(
      ruleset => ruleset.id == rulesetId
    );
}

export async function validate(bundledSubscriptions,
                               bundledSubscriptionsPath) {
  let warnings = [];

  for (let subscription of bundledSubscriptions) {
    let fileExists = await subscriptionFileExists(subscription,
                                                  bundledSubscriptionsPath);
    if (!fileExists)
      warnings.push(`No subscription content file for ID=${subscription.id}`);

    if (!rulesetExistsInManifest(subscription.id))
      warnings.push(`No ruleset with ID=${subscription.id} declared in the manifest`);
  }

  return warnings;
}

async function remove(url) {
  await initializer.start();

  let subscription = getSubscription(url);

  if (!subscription)
    throw new Error(`Subscription does not exist: ${url}`);

  filterEngine.filterStorage.removeSubscription(subscription);

  await disableRuleset(subscription.id);
}

export async function updateFilterText() {
  let removeUrls = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof RegularSubscription) {
      let subscriptionInfo = addonBundledSubscriptions.find(
        x => x.url == subscription.url);

      if (subscriptionInfo) {
        let filterText = await getFilterText(
          subscriptionInfo, addonBundledSubscriptionsPath);
        subscription.setFilterText(filterText);
      }
      else {
        removeUrls.push(subscription.url);
      }
    }
  }

  for (let url of removeUrls)
    await remove(url);
}

async function getDownloadable() {
  await initializer.start();

  let result = [];

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof RegularSubscription)
      result.push(convertSubscription(subscription));
  }

  return result;
}

async function add(url, properties = {}) {
  await initializer.start();

  if (!Subscription.isValidURL(url))
    throw new Error(`Invalid subscription URL provided: ${url}`);

  let {filterStorage} = filterEngine;

  let subscription = Subscription.fromURL(url);

  if (browser.declarativeNetRequest) {
    let subscriptionInfo = addonBundledSubscriptions.find(x => x.url == url);
    if (!subscriptionInfo)
      throw new Error(`Failed to find the subscription with URL=${url}`);

    if (!subscription.downloadable) {
      let filterText;
      try {
        filterText = await getFilterText(
          subscriptionInfo, addonBundledSubscriptionsPath);
      }
      catch (e) {
        // We already warn if the file doesn't exist on startup, so
        // we can ignore an error loading the bundled file here.
      }

      if (filterText)
        subscription.setFilterText(filterText);
    }
  }
  await enableRuleset(subscription.id);

  if ("title" in properties)
    subscription.title = properties.title;
  if ("homepage" in properties)
    subscription.homepage = properties.homepage;
  if ("downloadCount" in properties)
    subscription.downloadCount = properties.downloadCount;
  if ("version" in properties)
    subscription.version = properties.version;
  if ("lastDownload" in properties)
    subscription.lastDownload = properties.lastDownload;

  filterStorage.addSubscription(subscription);

  if (!subscription.lastDownload)
    filterStorage.synchronizer.execute(subscription);
}

async function disable(url) {
  await initializer.start();

  let subscription = getSubscription(url);

  if (!subscription)
    throw new Error(`Subscription does not exist: ${url}`);

  subscription.disabled = true;

  await disableRuleset(subscription.id);
}

function migrationNeeded() {
  if (browser.runtime.getManifest().manifest_version == 2)
    return false;

  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    // anti-cv subscriptions stay `DownloadableSubscriptions` even in MV3
    if (subscription.downloadable && subscription.type != "circumvention")
      return true;
  }

  return false;
}

function saveMigrationError(url, error) {
  Prefs.migration_errors.push({url, error});
}

export async function migrate() {
  if (!migrationNeeded())
    return;

  let downloadables = await getDownloadable();
  for (let downloadable of downloadables) {
    await remove(downloadable.url); // MV2 URL
    let subscriptionInfo = addonBundledSubscriptions.find(
      it => it.mv2_url == downloadable.url);
    if (subscriptionInfo) {
      try {
        await add(subscriptionInfo.url, {
          downloadCount: downloadable.downloadCount,
          version: downloadable.version,
          lastDownload: downloadable.lastDownload
        });
        if (!downloadable.enabled)
          await disable(subscriptionInfo.url);
      }
      catch (e) {
        saveMigrationError(downloadable.url, e.message);
      }
    }
    else {
      saveMigrationError(
        downloadable.url,
        `Failed to find the subscription with URL=${downloadable.url}`);
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
   *                                  downloaded and updated over the network.
   *                                  If `false` the subscription is merely
   *                                  a container for user-defined filters.
   * @property {boolean} downloading Indicates whether the subscription is
   *                                 currently downloading.
   * @property {string|null} downloadStatus The {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-subscriptionClasses.DownloadableSubscription.html?job=docs#downloadStatus|status}
   *                                        of the most recent download attempt.
   * @property {boolean} enabled Indicates whether this subscription will
   *                             be applied.
   * @property {number} expires
   * @property {?string} homepage Website of the project that manages
   *                              this filter list.
   * @property {number} lastDownload Epoch time when the subscription
   *                                 was last downloaded to your machine.
   * @property {number} lastSuccess Epoch time when this subscription was last
   *                                successfully downloaded.
   * @property {number} softExpiration
   * @property {string} title The display name of the subscription.
   *                          If not provided, falls back to the URL.
   * @property {string} url Where the subscription can be found in plain text.
   *                        Used a the identifier.
   * @property {string} version The version provided by the subscription's
   *                            metadata. Defaults to '0' if not provided.
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
   * @return {Promise}
   * @throws {Error} Invalid subscription URL provided.
   */
  add,

  /**
   * Adds a list of default subscriptions based on the provided bundled
   * subscriptions from the EWE.start() call.
   * Subscriptions are selected based on relevant language, type of
   * circumvention, and type of allowing.
   * @param {string} [uiLanguage] The relevant language used for
   * determining which subscriptions to add. If omitted,
   * browser.i18n.getUILanguage will be used. If
   * browser.i18n.getUILanguage is unavailable, navigator.language is
   * used.
   * @throws {Error} No default language subscription
   * @throws {Error} No current language subscription
   * @throws {Error} No anti-circumvention subscription
   * @throws {Error} No allowing subscription
   * @see {@link #start|start()}
   * @return {Promise}
   */
  async addDefaults(uiLanguage) {
    await initializer.start();

    let subscriptions = [];

    if (shouldAddDefaultSubscriptions()) {
      let defaultSubscriptions = getDefaultSubscriptions(uiLanguage);
      if (!defaultSubscriptions.hasDefaultLang)
        throw Error("No default language subscription");

      if (!defaultSubscriptions.hasCurrentLang)
        throw Error("No current language subscription");

      if (!defaultSubscriptions.hasAntiCV)
        throw Error("No anti-circumvention subscription");

      if (!defaultSubscriptions.hasAA)
        throw Error("No allowing subscription");

      subscriptions.push(...defaultSubscriptions.chosenSubscriptions);
    }

    for (let subscription of subscriptions)
      await this.add(subscription.url);
  },

  /**
   * Returns an array of subscription objects for all subscriptions that are
   * downloaded and updated over the network.
   * @return {Promise<Array<Subscription>>}
   */
  getDownloadable,

  /**
   * Returns an array of subscription objects for a given filter.
   * @param {string} text The filter rule for which to look.
   * @return {Promise<Array<Subscription>>}
   */
  async getForFilter(text) {
    await initializer.start();

    return text ? Array.from(filterEngine.filterStorage.subscriptions(text),
                             convertSubscription) : [];
  },

  /**
   * Returns the filter list of a given subscription URL.
   * @param {string} url The URL of the subscription.
   * @return {Promise<Array<Filter>>} Filters from the subscription.
   */
  async getFilters(url) {
    await initializer.start();

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
    await initializer.start();

    return getSubscription(new URL(url).href) != null;
  },

  /**
   * Enables a previously disabled subscription. Has no effect otherwise.
   * @param {string} url The URL of the subscription to be enabled.
   * @return {Promise}
   * @throws {Error} Subscription does not exist.
   */
  async enable(url) {
    await initializer.start();

    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    subscription.disabled = false;

    await enableRuleset(subscription.id);
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
   * @param {string} [url] The URL of the subscription to be synchronized.
   *   If omitted, all subscriptions will be synchronized.
   * @return {Promise} Resolves when syncing has been successfully
   *   triggered. Syncing may not be completed when this promise
   *   resolves.
   * @throws {Error} Subscription does not exist.
   */
  async sync(url) {
    await initializer.start();

    let subscriptions = [];
    let {filterStorage} = filterEngine;

    if (url) {
      let subscription = getSubscription(url);

      if (!subscription)
        throw new Error(`Subscription does not exist: ${url}`);

      subscriptions.push(subscription);
    }
    else {
      for (let subscription of filterStorage.subscriptions()) {
        if (subscription instanceof RegularSubscription)
          subscriptions.push(subscription);
      }
    }
    for (let subscription of subscriptions)
      filterStorage.synchronizer.execute(subscription, true);
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
   * @property {string} type The kind of content targeted by this
   *                         recommended subscription.
   * @property {string} url Where the recommended subscription can be found
   *                        in plain text.
   * @property {string} mv2URL Where the recommended subscription can be found
   *                            for MV2 in plain text.
   */

  /**
   * Returns an array of all recommended subscriptions.
   * @return {Array<Recommendation>}
   */
  getRecommendations() {
    return Array.from(recommendations(), convertRecommendation);
  },

  /**
   * Returns an array of MV2 to MV3 migration errors.
   * @return {array<string, string>} The migration errors.
   */
  getMigrationErrors() {
    return Prefs.migration_errors;
  },

  /**
   * Clears the migration errors.
   */
  clearMigrationErrors() {
    Prefs.migration_errors = [];
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
      if (property == "disabled")
        property = "enabled";

      return subscription => {
        if (subscription instanceof RegularSubscription)
          dispatch(convertSubscription(subscription), property);
      };
    }

    let properties = ["disabled", "title", "homepage", "lastDownload",
                      "downloadStatus", "downloading"];
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
