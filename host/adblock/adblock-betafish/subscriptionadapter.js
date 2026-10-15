/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */
/* For ESLint: List any global identifiers used in this file below */
/* global browser */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import abRecommendationData from "./data/betafish-subscriptions.json";

const legacyDistractionControlIDs = {
  "distraction-control-video": "https://cdn.adblockcdn.com/filters/distraction-control-video.txt",
  "distraction-control-survey": "https://cdn.adblockcdn.com/filters/distraction-control-survey.txt",
  "distraction-control-newsletter":
    "https://cdn.adblockcdn.com/filters/distraction-control-newsletter.txt",
  "distraction-control-push": "https://cdn.adblockcdn.com/filters/distraction-control-push.txt",
};

const v3URLCheck =
  browser.runtime.getManifest().manifest_version === 2
    ? (url) => !url.includes("/v3/")
    : (url) => url.includes("/v3/");

// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
const SubscriptionAdapter = (function getSubscriptionAdapter() {
  const addAdBlockProperties = function (sub) {
    let subscription = { ...sub };
    const { url } = subscription;
    if (abRecommendationData[url]) {
      subscription = Object.assign(subscription, abRecommendationData[url]);
      if (Object.prototype.hasOwnProperty.call(sub, "languages")) {
        subscription.languages = [].concat(sub.languages);
      }
      if (!Object.prototype.hasOwnProperty.call(subscription, "language")) {
        subscription.language = subscription.languages && subscription.languages.length > 0;
      }
    }
    subscription.correctedURL = subscription.url;
    return subscription;
  };

  // Get the URL for the corresponding ID
  const getUrlFromId = function (searchID) {
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { adblockId } = subscription;
      if (searchID === adblockId && v3URLCheck(url)) {
        return url;
      }
    }
    return "";
  };

  // Get the ID for the corresponding URL
  const getIdFromURL = function (searchURL) {
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { adblockId } = subscription;
      if (searchURL === url) {
        return adblockId;
      }
    }
    return null;
  };

  // Get the MV2 URL for the corresponding ID
  const getV2URLFromID = function (searchID) {
    for (const url in abRecommendationData) {
      const subscription = abRecommendationData[url];
      const { id } = subscription;
      if (searchID === id && !url.includes("/v3/")) {
        return url;
      }
    }
    return null;
  };

  // Get the MV2 URL for the corresponding URL
  // if not found, return the passed parameter
  const getV2URLFromURL = function (searchURL) {
    const subscription = abRecommendationData[searchURL];
    if (subscription && subscription.id) {
      return getV2URLFromID(subscription.id);
    }
    return searchURL;
  };

  // determine if the specified filter list is a legacy
  // Distraction Control filter list
  // returns true if the ID is a legacy DC filter list URL
  //         false otherwise
  const isLegacyDistractionControlById = function (id) {
    return Object.prototype.hasOwnProperty.call(legacyDistractionControlIDs, id);
  };

  // determine if the specified filter list is language specific
  // returns the boolean language attribue (if found)
  //         false otherwise
  const isLanguageSpecific = function (searchID) {
    // check for EasyList, as it is a language-specific list (en), but
    // shouldn't be treated as such by the AdBlock code
    if (searchID === "easylist") {
      return false;
    }

    for (let subscription of ewe.subscriptions.getRecommendations()) {
      subscription = addAdBlockProperties(subscription);
      const { adblockId } = subscription;
      if (adblockId === searchID) {
        return subscription.language;
      }
    }
    return false;
  };

  // Get the ID for the corresponding URL
  const getSubscriptionInfoFromURL = function (searchURL) {
    for (let subscription of ewe.subscriptions.getRecommendations()) {
      subscription = addAdBlockProperties(subscription);
      const { url } = subscription;
      if (searchURL === url) {
        return subscription;
      }
    }
    return null;
  };

  // Unsubcribe the user from the subscription specified in the argument
  const unsubscribe = async function (options) {
    const subscriptionUrl = getUrlFromId(options.adblockId);
    if (subscriptionUrl !== "") {
      try {
        await ewe.subscriptions.remove(subscriptionUrl, { reason: options.reason });
      } catch (e) {
        // do nothing
      }
    }
  };

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  const getSubscriptionsMinusText = async function () {
    const result = {};
    const subscriptions = await ewe.subscriptions.getSubscriptions();
    subscriptions.forEach(async (subscription) => {
      const tempSub = addAdBlockProperties(subscription);
      // if the subscription doesn't have a 'adblockId' property, use the 'URL' as an
      // 'adblockId' property
      if (!tempSub.adblockId || tempSub.adblockId === undefined) {
        tempSub.adblockId = `url:${subscription.url}`;
      }
      // add the 'subscribed' property
      tempSub.subscribed = true;
      result[tempSub.adblockId] = tempSub;
    });
    return result;
  };

  const rareFilterLists = {
    "http://fanboy.co.nz/fanboy-turkish.txt": 56,
    "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&mimetype=plaintext": 57,
    "https://adblock.gardar.net/is.abp.txt": 58,
    "https://github.com/SlashArash/adblockfa": 59,
    "https://adblock.ee/list.php": 60,
  };

  // Get a binary string representation of the users subscriptions
  const getSubscriptionsChecksum = async function () {
    let resultA = 0;
    let resultB = 0;
    const subscriptions = await ewe.subscriptions.getSubscriptions();
    subscriptions.forEach(async (subscription) => {
      const sub = addAdBlockProperties(subscription);
      let index = sub.index || 0; // 0 is the 'unkown' index
      // if URL wasn't found in our subscription file, check the rareFilterLists to get the index
      if (index === 0 && rareFilterLists[sub.url]) {
        index = rareFilterLists[sub.url];
      }
      index = parseInt(index, 10);
      // We can only use 31 bits because the leftmost bit is the signed bit
      if (index < 31) {
        resultA |= 2 ** index; // eslint-disable-line no-bitwise
      } else {
        resultB |= 2 ** (index - 31); // eslint-disable-line no-bitwise
      }
    });
    return resultB.toString(2).padStart(32, "0") + resultA.toString(2).padStart(31, "0");
  };

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  const getAllSubscriptionsMinusText = async function () {
    const userSubs = await getSubscriptionsMinusText();
    for (const subscription of ewe.subscriptions.getRecommendations()) {
      const sub = addAdBlockProperties(subscription);
      const { adblockId } = sub;
      if (!(adblockId in userSubs)) {
        userSubs[adblockId] = sub;
      } else {
        Object.assign(userSubs[adblockId], sub);
      }
    }
    for (const url in abRecommendationData) {
      let sub = { ...abRecommendationData[url] };
      sub.url = url;
      sub = addAdBlockProperties(sub);
      const { adblockId } = sub;
      if (!(adblockId in userSubs)) {
        userSubs[adblockId] = sub;
      }
    }
    return userSubs;
  };
  // Get all distraction control subscriptions
  // without the filter contents (text)
  const getDCSubscriptionsMinusText = async function () {
    const userSubs = await getAllSubscriptionsMinusText();
    const result = {};
    for (const adblockId in userSubs) {
      const { url, type, title, homepage, hidden, subscribed, index } = userSubs[adblockId];
      if (url === "https://easylist-downloads.adblockplus.org/adblock_premium.txt") {
        result[adblockId] = {};
        result[adblockId].subscribed = subscribed;
        result[adblockId].adblockId = adblockId;
        result[adblockId].url = url;
        result[adblockId].userSubmitted = false;
        result[adblockId].hidden = hidden;
        result[adblockId].type = type;
        result[adblockId].title = title;
        result[adblockId].homepage = homepage;
        result[adblockId].index = index;
      }
    }
    return result;
  };

  // Subcribe the user to the subscription specified in the argument
  const subscribe = function (options) {
    if (options && options.adblockId) {
      const subscriptionUrl = getUrlFromId(options.adblockId);
      if (subscriptionUrl) {
        ewe.subscriptions.add(subscriptionUrl, { reason: options.reason });
      }
    }
  };

  return {
    getSubscriptionInfoFromURL,
    getUrlFromId,
    unsubscribe,
    subscribe,
    getSubscriptionsMinusText,
    getSubscriptionsChecksum,
    getAllSubscriptionsMinusText,
    getDCSubscriptionsMinusText,
    getIdFromURL,
    isLegacyDistractionControlById,
    legacyDistractionControlIDs,
    isLanguageSpecific,
    getV2URLFromID,
    getV2URLFromURL,
  };
})();

export default SubscriptionAdapter;
