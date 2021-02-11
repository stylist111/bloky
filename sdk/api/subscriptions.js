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

import {EventDispatcher} from "./events.js";

function convertSubscription({disabled, downloadStatus, homepage,
                              version, lastDownload, lastSuccess,
                              softExpiration, expires, title, url})
{
  return {disabled, downloading: synchronizer.isExecuting(url),
          downloadStatus, homepage, version, lastDownload, lastSuccess,
          softExpiration, expires, title, url};
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
   * A resource downloaded and updated over the network that
   * provides a list of filters that decide what to block.
   * @typedef {Object} Subscription
   * @property {boolean} disabled Indicates whether this subscription will
   *                              be applied.
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
   *                              this filter list
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
   * Creates a new subscription from a given URL.
   * @param {string} url The URL of the subscription to be added.
   */
  add(url)
  {
    if (!Subscription.isValidURL(url))
      throw new Error(`Invalid subscription URL provided: ${url}`);

    let subscription = Subscription.fromURL(url);
    filterStorage.addSubscription(subscription);

    if (!subscription.lastDownload)
      synchronizer.execute(subscription);
  },

  /**
   * Returns an array of subscription objects that have been added.
   * @return {Array.<Subscription>}
   */
  getAll()
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
   * Changes the given properties of the subscription with the given URL.
   * @param {string} url The URL of the subscription to be updated.
   * @param {object} properties An object with the properties to be updated
   *                            and their respective new values. Only `disabled`
   *                            and `title` can be updated. Other properties
   *                            (if given) are ignored.
   * @return {undefined}
   */
  update(url, properties)
  {
    let subscription = getSubscription(url);

    if (!subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    if ("disabled" in properties)
      subscription.disabled = properties.disabled;
    if ("title" in properties)
      subscription.title = properties.title;
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
          subscriptions.push(subscriptions);
      }
    }
    for (let subscription of subscriptions)
      synchronizer.execute(subscription, true);
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
        filterStorage.addSubscription(subscription);
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
   * Emitted when a subscription is updated or disabled.
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
