import browser from "webextension-polyfill";

import {filterEngine} from "../adblockpluscore/lib/filterEngine.js";
import {synchronizer} from "../adblockpluscore/lib/synchronizer.js";
import {Filter} from "../adblockpluscore/lib/filterClasses.js";
import {filterStorage} from "../adblockpluscore/lib/filterStorage.js";
import {Subscription, DownloadableSubscription}
  from "../adblockpluscore/lib/subscriptionClasses.js";
import {recommendations} from "../adblockpluscore/lib/recommendations.js";

import {startRecordingFrames, stopRecordingFrames} from "./frame-state.js";
import {startBlocking, stopBlocking} from "./request-blocking.js";
import {startContentFiltering, stopContentFiltering}
  from "./content-filtering.js";
import "./popup-blocker.js";

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
    startRecordingFrames()
  ]);

  if (!stopped)
  {
    startBlocking();
    startContentFiltering();
  }
}

export function stop()
{
  stopped = true;
  synchronizer.stop();
  stopRecordingFrames();
  stopBlocking();
  stopContentFiltering();
}
