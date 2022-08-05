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

import {recommendations} from "adblockpluscore/lib/recommendations.js";
import {Subscription, DownloadableSubscription, SpecialSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";

import {filterEngine} from "./core.js";

export const ACCEPTABLE_ADS_URL = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
export const ACCEPTABLE_ADS_PRIVACY_URL = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";

export function getDefaultSubscriptions() {
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1159438
  let currentLang = (browser.i18n.getUILanguage ?
    browser.i18n.getUILanguage() : navigator.language).split("-")[0];
  let defaultLang = (browser.runtime.getManifest()
                                    .default_locale || "en").split("_")[0];

  let adSubscriptions = [];
  let adSubscriptionsDefaultLang = [];
  let chosenSubscriptions = [];

  for (let subscription of recommendations()) {
    switch (subscription.type) {
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
                                     adSubscriptionsDefaultLang).length > 0) {
    let randomIndex = Math.floor(Math.random() * adSubscriptions.length);
    chosenSubscriptions.unshift(adSubscriptions[randomIndex]);
  }

  return chosenSubscriptions;
}

function shouldAddDefaultSubscriptions() {
  let {filterStorage} = filterEngine;
  for (let subscription of filterStorage.subscriptions()) {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != ACCEPTABLE_ADS_URL &&
        subscription.type != "circumvention")
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filterCount > 0)
      return false;
  }

  return true;
}

export function configureDefaultSubscriptions() {
  let subscriptions = [];
  let {filterStorage} = filterEngine;
  let foundSubscriptions = filterStorage.getSubscriptionCount() != 0;

  if (!foundSubscriptions) {
    subscriptions.push({url: ACCEPTABLE_ADS_URL,
                        title: "Allow non-intrusive advertising"});
  }

  if (shouldAddDefaultSubscriptions())
    subscriptions.push(...getDefaultSubscriptions());

  for (let {url, title, homepage} of subscriptions) {
    let subscription = Subscription.fromURL(url);
    subscription.disabled = false;
    subscription.title = title;
    subscription.homepage = homepage;

    filterStorage.addSubscription(subscription);
    if (!subscription.lastDownload)
      filterStorage.synchronizer.execute(subscription);
  }

  return {foundSubscriptions, foundStorage: !filterStorage.firstRun};
}
