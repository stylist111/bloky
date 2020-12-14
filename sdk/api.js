import browser from "webextension-polyfill";

import {filterEngine} from "../adblockpluscore/lib/filterEngine.js";
import {synchronizer} from "../adblockpluscore/lib/synchronizer.js";
import {Filter} from "../adblockpluscore/lib/filterClasses.js";
import {filterStorage} from "../adblockpluscore/lib/filterStorage.js";
import {Subscription, DownloadableSubscription}
  from "../adblockpluscore/lib/subscriptionClasses.js";
import {recommendations} from "../adblockpluscore/lib/recommendations.js";
import {notifications} from "../adblockpluscore/lib/notifications.js";

import * as frameState from "./frame-state.js";
import * as requestBlocker from "./request-blocker.js";
import * as contentFilter from "./content-filter.js";
import * as popupBlocker from "./popup-blocker.js";
import * as csp from "./csp.js";

export function configureDefaultSubscriptions()
{
  for (let {url, title, homepage} of getDefaultSubscriptions())
  {
    let subscription = Subscription.fromURL(url);
    subscription.disabled = false;
    subscription.title = title;
    subscription.homepage = homepage;

    filterStorage.addSubscription(subscription);
    if (!subscription.lastDownload)
      synchronizer.execute(subscription);
  }
}

function getDefaultSubscriptions()
{
  let currentLang = browser.i18n.getUILanguage().split("-")[0];
  let defaultLang = (browser.runtime.getManifest().default_locale ||
                     "en_US").split("_")[0];

  let adSubscriptions = [];
  let adSubscriptionsDefaultLang = [];
  let chosenSubscriptions = [];

  for (let subscription of recommendations())
  {
    switch (subscription.type)
    {
      case "ads":
        if (subscription.languages.includes(currentLang))
          adSubscriptions.push(subscription);
        if (subscription.languages.includes(defaultLang))
          adSubscriptionsDefaultLang.push(subscription);
        break;

      case "circumvention":
        chosenSubscriptions.push(subscription);
        break;
    }
  }

  if (adSubscriptions.length > 0 || (adSubscriptions =
                                     adSubscriptionsDefaultLang).length > 0)
  {
    let randomIndex = Math.floor(Math.random() * adSubscriptions.length);
    chosenSubscriptions.unshift(adSubscriptions[randomIndex]);
  }

  return chosenSubscriptions;
}

export function addFilter(filter)
{
  filterEngine.add(Filter.fromText(filter));
}

export function addSubscription(url)
{
  let subscription = Subscription.fromURL(url);

  filterStorage.addSubscription(subscription);
  if (subscription instanceof DownloadableSubscription &&
      !subscription.lastDownload)
    synchronizer.execute(subscription);
}

let stopped = true;

export async function start()
{
  stopped = false;

  await Promise.all([
    filterEngine.initialize().then(() =>
    {
      if (!stopped)
        synchronizer.start();
    }),
    frameState.start()
  ]);

  if (!stopped)
  {
    requestBlocker.start();
    popupBlocker.start();
    contentFilter.start();
    csp.start();
    notifications.start();
  }
}

export function stop()
{
  stopped = true;
  synchronizer.stop();
  frameState.stop();
  requestBlocker.stop();
  popupBlocker.stop();
  contentFilter.stop();
  csp.stop();
  notifications.stop();
}
