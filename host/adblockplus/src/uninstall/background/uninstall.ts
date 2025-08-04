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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { isDataCorrupted } from "../../../adblockpluschrome/lib/subscriptionInit";
import { info } from "~/info/background";
import { getPremiumState } from "~/premium/background";

/**
 * List of URL parameters containing their shortened name (used in the URL to
 * save space) and their expanded name (used in the code for legibility).
 */
const abbreviations = [
  ["an", "addonName"],
  ["ap", "application"],
  ["apv", "applicationVersion"],
  ["av", "addonVersion"],
  ["c", "corrupted"],
  ["er", "experimentsRevision"],
  ["ev", "experimentsVariants"],
  ["ca", "cohortAssignments"],
  ["fv", "firstVersion"],
  ["ndc", "notificationDownloadCount"],
  ["p", "platform"],
  ["ps", "premiumStatus"],
  ["pv", "platformVersion"],
  ["s", "subscriptions"],
  ["wafc", "webAllowlistingFilterCount"]
];

/**
 * Returns the number of currently active filters that have been added using
 * the experimental allowlisting functionality (i.e. that originated in the
 * web, and not in the extension popup).
 *
 * @returns The filter count
 */
async function getWebAllowlistingFilterCount(): Promise<number> {
  // get all allowlisting filters that are enabled
  const filters = (await ewe.filters.getUserFilters()).filter(
    (filter) => filter.type === "allowing" && filter.enabled
  );

  // collect their metadata
  const filtersMetadata = await Promise.all(
    filters.map(async (filter) => await ewe.filters.getMetadata(filter.text))
  );

  // count the ones that originated in the web
  return filtersMetadata.filter((data) => data && data.origin === "web").length;
}

/**
 * Retrieves set of URLs of recommended ad blocking filter lists
 *
 * @returns ad-filtering subscriptions
 */
function getAdsSubscriptions(): Set<string> {
  const subscriptions = new Set<string>();

  for (const subscription of ewe.subscriptions.getRecommendations()) {
    if (subscription.type === "ads") {
      subscriptions.add(subscription.url);
    }
  }

  return subscriptions;
}

/**
 * Determines whether any of the given subscriptions are installed and enabled
 *
 * @param urls - Subscription URLs
 * @returns whether any of the given subscriptions are installed and enabled
 */
async function isAnySubscriptionActive(urls: Set<string>): Promise<boolean> {
  for (const subscription of await ewe.subscriptions.getSubscriptions()) {
    if (subscription.enabled && urls.has(subscription.url)) {
      return true;
    }
  }

  return false;
}

/**
 * Sets (or updates) the URL that is openend when the extension is uninstalled.
 *
 * Must be called after prefs got initialized and a data corruption
 * if any was detected, as well when notification data change.
 */
export async function setUninstallURL(): Promise<void> {
  const search = [];
  const params = Object.create(info);

  params.corrupted = isDataCorrupted() ? "1" : "0";
  params.experimentsRevision = await ewe.remoteConfig.getRevisionId();
  params.experimentsVariants = await ewe.experiments.getEncodedExperiments();
  params.cohortAssignments = await ewe.cohorts.getEncodedCohorts();
  params.firstVersion = ewe.reporting.getFirstVersion();

  const notificationDownloadCount = await ewe.notifications.getDownloadCount();
  if (notificationDownloadCount < 5) {
    params.notificationDownloadCount = notificationDownloadCount;
  } else if (notificationDownloadCount < 8) {
    params.notificationDownloadCount = "5-7";
  } else if (notificationDownloadCount < 30) {
    params.notificationDownloadCount = "8-29";
  } else if (notificationDownloadCount < 90) {
    params.notificationDownloadCount = "30-89";
  } else if (notificationDownloadCount < 180) {
    params.notificationDownloadCount = "90-179";
  } else {
    params.notificationDownloadCount = "180+";
  }

  const aaSubscriptions = new Set([ewe.subscriptions.ACCEPTABLE_ADS_URL]);
  const adsSubscriptions = getAdsSubscriptions();
  const isAcceptableAdsActive = await isAnySubscriptionActive(aaSubscriptions);
  const isAdBlockingActive = await isAnySubscriptionActive(adsSubscriptions);
  params.subscriptions =
    (Number(isAcceptableAdsActive) << 1) | Number(isAdBlockingActive);
  const premiumState = await getPremiumState();
  params.premiumStatus = premiumState.isActive ? 1 : 0;
  params.webAllowlistingFilterCount = await getWebAllowlistingFilterCount();

  for (const [abbreviation, key] of abbreviations) {
    const value = params[key];
    if (
      typeof value !== "boolean" &&
      typeof value !== "number" &&
      typeof value !== "string"
    ) {
      continue;
    }

    search.push(abbreviation + "=" + encodeURIComponent(value));
  }

  void browser.runtime.setUninstallURL(
    Prefs.getDocLink("uninstalled") + "&" + search.join("&")
  );
}

/**
 * Initializes the uninstall module
 */
export function start(): void {
  ewe.remoteConfig.onChanged.addListener(setUninstallURL);
  ewe.experiments.onChanged.addListener(setUninstallURL);
  ewe.cohorts.onChanged.addListener(setUninstallURL);

  ewe.notifications.on("downloaded", setUninstallURL);

  ewe.filters.onAdded.addListener(setUninstallURL);
  ewe.filters.onChanged.addListener(setUninstallURL);
  ewe.filters.onRemoved.addListener(setUninstallURL);

  ewe.subscriptions.onAdded.addListener(setUninstallURL);
  ewe.subscriptions.onChanged.addListener(async (subscription, property) => {
    if (property !== "enabled") {
      return;
    }

    await setUninstallURL();
  });
  ewe.subscriptions.onRemoved.addListener(setUninstallURL);

  void setUninstallURL();
}
