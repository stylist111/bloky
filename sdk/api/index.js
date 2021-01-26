import browser from "webextension-polyfill";

import {recommendations} from "../../adblockpluscore/lib/recommendations.js";
import {filterEngine} from "../../adblockpluscore/lib/filterEngine.js";
import {synchronizer} from "../../adblockpluscore/lib/synchronizer.js";
import {notifications} from "../../adblockpluscore/lib/notifications.js";
import {Subscription} from "../../adblockpluscore/lib/subscriptionClasses.js";
import {filterStorage} from "../../adblockpluscore/lib/filterStorage.js";

import * as frameState from "./frame-state.js";
import * as requestFilter from "./request-filter.js";
import * as messageResponder from "./message-responder.js";
import * as popupBlocker from "./popup-blocker.js";

export {onSubscribeLinkClicked} from "./subscribe-links.js";
export {default as subscriptions} from "./subscriptions.js";
export {default as filters} from "./filters.js";

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

let stopped = true;

export async function start()
{
  stopped = false;

  notifications.locale = browser.i18n.getUILanguage();
  notifications.start();
  await filterEngine.initialize();

  if (stopped)
    return;

  synchronizer.start();
  await frameState.start();

  if (stopped)
    return;

  requestFilter.start();
  popupBlocker.start();
  messageResponder.start();
}

export function stop()
{
  stopped = true;
  synchronizer.stop();
  frameState.stop();
  requestFilter.stop();
  popupBlocker.stop();
  messageResponder.stop();
  notifications.stop();
}
