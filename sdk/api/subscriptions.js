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

import {Subscription, DownloadableSubscription}
  from "../../adblockpluscore/lib/subscriptionClasses.js";
import {filterStorage} from "../../adblockpluscore/lib/filterStorage.js";
import {synchronizer} from "../../adblockpluscore/lib/synchronizer.js";
import {filterNotifier} from "../../adblockpluscore/lib/filterNotifier.js";
import {recommendations} from "../../adblockpluscore/lib/recommendations.js";
import {Filter} from "../../adblockpluscore/lib/filterClasses.js";

import {EventDispatcher} from "./types.js";
import {convertFilter} from "./filters.js";

function convertSubscription(subscription)
{
  let {disabled, downloadStatus, homepage,
       version, lastDownload, lastSuccess,
       softExpiration, expires, title, url} = subscription;

  return {enabled: !disabled, downloading: synchronizer.isExecuting(url),
          downloadStatus, homepage, version, lastDownload, lastSuccess,
          softExpiration, expires, title, url,
          downloadable: subscription instanceof DownloadableSubscription};
}

function convertRecommendation({languages, title, type, url})
{
  return {languages, title, type, url};
}

function getSubscription(url)
{
  let subscription = Subscription.fromURL(url);

  if (filterStorage.hasSubscription(subscription) &&
      subscription instanceof DownloadableSubscription)
    return subscription;

  return null;
}

function makeListener(dispatch)
{
  return subscription =>
  {
    if (subscription instanceof DownloadableSubscription)
      dispatch(convertSubscription(subscription));
  };
}

export default {
  /**
   * A resource that provides a list of filters that decide what to block.
   * @typedef {Object} Subscription
   * @property {boolean} enabled Indicates whether this subscription will
   *                             be applied.
   * @property {?string} downloadStatus The status code of the most recent
   *                                    download attempt. The value
   *                                    "synchronize_ok" indicates a successful
   *                                    download, other string values indicate
   *                                    different errors. While the initial
   *                                    download hasn't completed yet it's null.
   * @property {string} downloading Indicates whether the subscription is
   *                                currently downloading.
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
   * @property {boolean} downloadable Indicates whether this subscription is
   *                                  downloaded and updated over the network.
   *                                  If `false` the subscription is merely
   *                                  a container for user-defined filters.
   */

  /**
   * Creates a new subscription from a given URL.
   * @param {string} url The URL of the subscription to be added.
   * @param {object} [properties] An object containing properties to be
   *                              set on the new subscription.
   * @param {string} [properties.title] The display name of the subscription.
   *                                    If not provided, falls back to the URL.
   * @param {string} [properties.homepage] Website of the project that
   *                                       manages this filter list.
   */
  add(url, properties = {})
  {
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
   * @return {Array.<Subscription>}
   */
  getDownloadable()
  {
    let result = [];

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof DownloadableSubscription)
        result.push(convertSubscription(subscription));
    }

    return result;
  },

  /**
   * Returns an array of subscription objects for a given filter.
   * @param {string} text The filter rule for which to look.
   * @return {Array.<Subscription>}
   */
  getForFilter(text)
  {
    return text ? Array.from(filterStorage.subscriptions(text),
                             convertSubscription) : [];
  },

  /**
   * Returns the filter list of a given subscription URL.
   * @param {string} url The URL of the subscription.
   * @return {Array.<Filter>|undefined} Filters from the subscription, or
   *                                    undefined if the subscription was not
   *                                    previously added.
   */
  getFilters(url)
  {
    let subscription = getSubscription(url);
    if (subscription)
    {
      return Array.from(subscription.filterText(),
                        text => convertFilter(Filter.fromText(text)));
    }
  },

  /**
   * Checks if a subscription has been added.
   * @param {string} url The URL of the subscription to be checked.
   * @return {boolean} True if a subscription has been added.
   * @throws {TypeError} Invalid url provided.
   */
  has(url)
  {
    return getSubscription(new URL(url).href) != null;
  },

  /**
   * Enables a previously disabled subscription. Has no effect otherwise.
   * @param {string} url The URL of the subscription to be enabled.
   * @throws {Error} Subscription does not exist
   * @return {undefined}
   */
  enable(url)
  {
    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    subscription.disabled = false;
  },

  /**
   * Disables a subscription so that it doesn't have any
   * effect until it gets enabled again.
   * @param {string} url The URL of the subscription to be disabled.
   * @throws {Error} Subscription does not exist
   * @return {undefined}
   */
  disable(url)
  {
    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    subscription.disabled = true;
  },

  /**
   * Removes the subscription for the given URL.
   * It will no longer have any effect.
   * @param {string} url The URL of the subscription to be removed.
   * @return {undefined}
   */
  remove(url)
  {
    let subscription = getSubscription(url);

    if (subscription)
      filterStorage.removeSubscription(subscription);
  },

  /**
   * Forces a new version of a subscription with the
   * given URL to be downloaded immediately.
   * @param {string} [url] The URL of the subscription to be synchronized.
   *                       If omitted, all subscriptions will be synchronized.
   * @return {undefined}
   */
  sync(url)
  {
    let subscriptions = [];

    if (url)
    {
      let subscription = getSubscription(url);

      if (!subscription)
        throw new Error(`Subscription does not exist: ${url}`);

      subscriptions.push(subscription);
    }
    else
    {
      for (let subscription of filterStorage.subscriptions())
      {
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
   * @property {Array.<string>} languages The languages that this recommendation
   *                                      would match to.
   * @property {string} title The display name of the recommended subscription.
   * @property {string} type The kind of content targeted by this
   *                         recommended subscription.
   * @property {string} url Where the recommended subscription can be found
   *                        in plain text.
   */

  /**
   * Returns an array of all recommended subscriptions.
   * @return {Array.<Recommendation>}
   */
  getRecommendations()
  {
    return Array.from(recommendations(), convertRecommendation);
  },

  /**
   * Clears all subscriptions and filters.
   * @return {function} A function that can be called to
   *                    restore the removed subscriptions and filters.
   * @private
   */
  removeAll()
  {
    let subscriptions = [];

    for (let subscription of filterStorage.subscriptions())
    {
      subscriptions.push(subscription);
      filterStorage.removeSubscription(subscription);
    }

    return () =>
    {
      this.removeAll();

      for (let subscription of subscriptions)
      {
        if (subscription instanceof DownloadableSubscription)
        {
          let {url, title, homepage} = subscription;
          this.add(url, {title, homepage});
        }
        else
        {
          filterStorage.addSubscription(subscription);
        }
      }
    };
  },

  /**
   * Emitted when a new subscription is added.
   * @event
   * @type {EventDispatcher.<Subscription>}
   */
  onAdded: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.added", makeListener(dispatch));
  }),

  /**
   * Emitted when any property of the subscription has changed.
   * @event
   * @type {EventDispatcher.<Subscription>}
   */
  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.disabled", makeListener(dispatch));
    filterNotifier.on("subscription.updated", makeListener(dispatch));
  }),

  /**
   * Emitted when a subscription is removed.
   * @event
   * @type {EventDispatcher.<Subscription>}
   */
  onRemoved: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.removed", makeListener(dispatch));
  })
};
