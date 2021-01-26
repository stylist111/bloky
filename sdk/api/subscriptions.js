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
  add(url)
  {
    if (!Subscription.isValidURL(url))
      throw new Error(`Invalid subscription URL provided: ${url}`);

    let subscription = Subscription.fromURL(url);
    filterStorage.addSubscription(subscription);

    if (!subscription.lastDownload)
      synchronizer.execute(subscription);
  },

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

  update(url, properties)
  {
    let subscription = getSubscription(url);

    if (subscription)
      throw new Error(`Subscription does not exist: ${url}`);

    if ("disabled" in properties)
      subscription.disabled = properties.disabled;
    if ("title" in properties)
      subscription.title = properties.title;
  },

  remove(url)
  {
    let subscription = getSubscription(url);

    if (subscription)
      filterStorage.removeSubscription(subscription);
  },

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

  onAdded: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.added", makeListener(dispatch));
  }),

  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.disabled", makeListener(dispatch));
    filterNotifier.on("subscription.updated", makeListener(dispatch));
  }),

  onRemoved: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("subscription.removed", makeListener(dispatch));
  })
};
