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
/* global browser, addCustomFilter */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { setBadge } from "~/../adblockplusui/adblockpluschrome/lib/action";
import { getSettings, settings } from "../prefs/background";

const twitchChannelNamePages = new Map();

const webRequestFilter = {
  url: [{ hostEquals: "www.twitch.tv" }],
};

// On single page sites, such as Twitch, that update the URL using the History API pushState(),
// update the badge (clear the block count) when allow listed
const historyStateHandler = async function (details) {
  if (
    details &&
    Object.prototype.hasOwnProperty.call(details, "url") &&
    Object.prototype.hasOwnProperty.call(details, "tabId") &&
    details.transitionType === "link"
  ) {
    const myURL = new URL(details.url);
    if (myURL.hostname === "www.twitch.tv") {
      const filters = await ewe.filters.getAllowingFilters(details.tabId);
      const isAllowListed = !!filters.length;
      if (isAllowListed) {
        setBadge(details.tabId, { number: "" });
      }
    }
  }
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
const createAllowlistFilterForTwitchChannel = function (url, origin) {
  let twitchChannel;
  if (/ab_channel=/.test(url)) {
    [, twitchChannel] = url.match(/ab_channel=([^]*)/);
  } else {
    twitchChannel = url.split("/").pop();
  }
  if (twitchChannel) {
    const filter = `@@||twitch.tv/*${twitchChannel}^$document`;
    return addCustomFilter(filter, origin);
  }
  return undefined;
};

const twitchMessageHandler = function (message, sender) {
  if (message.command === "createAllowlistFilterForTwitchChannel" && message.url) {
    createAllowlistFilterForTwitchChannel(message.url, message.origin);
  }
  if (message.command === "updateTwitchChannelName" && message.channelName) {
    twitchChannelNamePages.set(sender.tab.id, message.channelName);
  }
};

const addTwitchAllowlistListeners = function () {
  twitchChannelNamePages.clear();
  browser.runtime.onMessage.addListener(twitchMessageHandler);
  browser.webNavigation.onHistoryStateUpdated.addListener(historyStateHandler, webRequestFilter);
};

const removeTwitchAllowlistListeners = function () {
  twitchChannelNamePages.clear();
  browser.runtime.onMessage.removeListener(twitchMessageHandler);
  browser.webNavigation.onHistoryStateUpdated.removeListener(historyStateHandler, webRequestFilter);
};

const start = async function () {
  await settings.onload();
  if (getSettings().twitch_channel_allowlist) {
    addTwitchAllowlistListeners();
  }
};

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  addTwitchAllowlistListeners,
  removeTwitchAllowlistListeners,
  twitchChannelNamePages,
});

void start();
