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

import {Subscription, DownloadableSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {filterStorage} from "adblockpluscore/lib/filterStorage.js";
import {synchronizer} from "adblockpluscore/lib/synchronizer.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {recommendations} from "adblockpluscore/lib/recommendations.js";
import {Filter} from "adblockpluscore/lib/filterClasses.js";

import {EventDispatcher} from "./types.js";
import {convertFilter} from "./filters.js";
import {removeDynamicFilters} from "./dnr-filters.js";
import {ACCEPTABLE_ADS_URL, ACCEPTABLE_ADS_PRIVACY_URL}
  from "./default-subscriptions.js";

function convertSubscription(subscription) {
  let {disabled, downloadStatus, homepage,
       version, lastDownload, lastSuccess,
       softExpiration, expires, title, url} = subscription;

  return {enabled: !disabled, downloading: synchronizer.isExecuting(url),
          downloadStatus, homepage, version, lastDownload, lastSuccess,
          softExpiration, expires, title, url,
          downloadable: subscription instanceof DownloadableSubscription};
}

function convertRecommendation({languages, title, type, url}) {
  return {languages, title, type, url};
}

function getSubscription(url) {
  let subscription = Subscription.fromURL(url);

  if (filterStorage.hasSubscription(subscription) &&
      subscription instanceof DownloadableSubscription)
    return subscription;

  return null;
}

function makeListener(dispatch) {
  return subscription => {
    if (subscription instanceof DownloadableSubscription)
      dispatch(convertSubscription(subscription));
  };
}

export default {
  /**
   * The URL of the Acceptable Ads subscription.
   * @type {string}
   */
  ACCEPTABLE_ADS_URL,

  /**
   * The URL of the Acceptable Ads without third-party tracking subscription.
   * @type {string}
   */
  ACCEPTABLE_ADS_PRIVACY_URL,

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
   * @throws {Error} Invalid subscription URL provided.
   */
  add(url, properties = {}) {
    if (!Subscription.isValidURL(url))
      throw new Error(`Invalid subscription URL provided: ${url}`);

    let subscription = Subscription.fromURL(url);
    filterStorage.addSubscription(subscription);

    if ("title" in properties)
      subscription.title = properties.title;
    if ("homepage" in properties)
      subscription.homepage = properties.homepage;

    if (!subscription.lastDownload)
      synchronizer.execute(subscription);
  },

  /**
   * Returns an array of subscription objects for all subscriptions that are
   * downloaded and updated over the network.
   * @return {Array<Subscription>}
   */
  getDownloadable() {
    let result = [];

    for (let subscription of filterStorage.subscriptions()) {
      if (subscription instanceof DownloadableSubscription)
        result.push(convertSubscription(subscription));
    }

    return result;
  },

  /**
   * Returns an array of subscription objects for a given filter.
   * @param {string} text The filter rule for which to look.
   * @return {Array<Subscription>}
   */
  getForFilter(text) {
    return text ? Array.from(filterStorage.subscriptions(text),
                             convertSubscription) : [];
  },

  /**
   * Returns the filter list of a given subscription URL.
   * @param {string} url The URL of the subscription.
   * @return {Array<Filter>} Filters from the subscription.
   */
  getFilters(url) {
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
   * @return {boolean} True if a subscription has been added.
   * @throws {TypeError} Invalid URL provided.
   */
  has(url) {
    return getSubscription(new URL(url).href) != null;
  },

  /**
   * Enables a previously disabled subscription. Has no effect otherwise.
   * @param {string} url The URL of the subscription to be enabled.
   * @throws {Error} Subscription does not exist.
   */
  enable(url) {
    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    subscription.disabled = false;
  },

  /**
   * Disables a subscription so that it doesn't have any
   * effect until it gets enabled again.
   * @param {string} url The URL of the subscription to be disabled.
   * @throws {Error} Subscription does not exist.
   */
  disable(url) {
    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    subscription.disabled = true;
  },

  /**
   * Removes the subscription for the given URL.
   * It will no longer have any effect.
   * @param {string} url The URL of the subscription to be removed.
   */
  remove(url) {
    let subscription = getSubscription(url);

    if (subscription)
      filterStorage.removeSubscription(subscription);
  },

  /**
   * Forces a new version of a subscription with the
   * given URL to be downloaded immediately.
   * @param {string} [url] The URL of the subscription to be synchronized.
   *                       If omitted, all subscriptions will be synchronized.
   * @throws {Error} Subscription does not exist.
   */
  sync(url) {
    let subscriptions = [];

    if (url) {
      let subscription = getSubscription(url);

      if (!subscription)
        throw new Error(`Subscription does not exist: ${url}`);

      subscriptions.push(subscription);
    }
    else {
      for (let subscription of filterStorage.subscriptions()) {
        if (subscription instanceof DownloadableSubscription)
          subscriptions.push(subscription);
      }
    }
    for (let subscription of subscriptions)
      synchronizer.execute(subscription, true);
  },

  /**
   * Defines the recommended filter subscriptions per language.
   * @typedef {Object} Recommendation
   * @property {Array<string>} languages The languages that this recommendation
   *                                      would match to.
   * @property {string} title The display name of the recommended subscription.
   * @property {string} type The kind of content targeted by this
   *                         recommended subscription.
   * @property {string} url Where the recommended subscription can be found
   *                        in plain text.
   */

  /**
   * Returns an array of all recommended subscriptions.
   * @return {Array<Recommendation>}
   */
  getRecommendations() {
    return Array.from(recommendations(), convertRecommendation);
  },

  /**
   * Clears all subscriptions and filters.
   * @return {function} A function that can be called to
   *                    restore the removed subscriptions and filters.
   * @private
   */
  async removeAll() {
    let subscriptions = [];

    for (let subscription of filterStorage.subscriptions()) {
      subscriptions.push(subscription);
      filterStorage.removeSubscription(subscription);
    }

    let addRules = await removeDynamicFilters();

    return async() => {
      await this.removeAll();

      for (let subscription of subscriptions) {
        if (subscription instanceof DownloadableSubscription) {
          let {url, title, homepage} = subscription;
          this.add(url, {title, homepage});
        }
        else {
          filterStorage.addSubscription(subscription);
        }
      }

      // This workaround should be removed once subscriptions management
      // supports mv3
      if (browser.declarativeNetRequest)
        await browser.declarativeNetRequest.updateDynamicRules({addRules});
    };
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
        if (subscription instanceof DownloadableSubscription)
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
