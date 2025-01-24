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
/* global browser, isTrustedSender,  getUserFilters,
   addCustomFilter, countCache, checkUpdateProgress,
   adblockIsPaused, pageIsWhitelisted, getCurrentTabInfo,
   openTab, updateFilterLists, isTrustedSenderDomain, updateButtonUIAndContextMenus,
   getDebugInfo, addYTChannelListeners, removeYTChannelListeners, openYTManagedSubPage,
   addTwitchAllowlistListeners, removeTwitchAllowlistListeners, abpPrefPropertyNames,
   pausedFilterText1, pausedFilterText2, updateCustomFilterCountMap
*/

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { toPlainFilterError } from "../../adblockplusui/adblockpluschrome/lib/messaging/types";

import {
  getSettings,
  setSetting,
  settings,
  settingsNotifier,
  isValidTheme,
} from "../prefs/background";
import SubscriptionAdapter from "../subscriptionadapter";
import DataCollectionV2 from "../datacollection.v2";
import ServerMessages from "../servermessages";
import LocalDataCollection from "../localdatacollection";
import ExcludeFilter from "../excludefilter";
import messageValidator from "./messagevalidator";
import { getNewBadgeTextReason, resetBadgeText } from "../alias/icon";
import { createFilterMetaData } from "../utilities/background/bg-functions";
import { getReadyState } from "../testing/ready-state/background/index.ts";
import { getInfoCommand, injectionOrigins } from "../../src/info-injector/shared";
import { getInjectionInfo } from "../../src/info-injector/background";
import { getUserId } from "~/id/background/index";
import { allowlistTab, removeAllAllowlistRulesForTab } from "../../src/pause/background/index";

export const processMessageResponse = (sendResponse, responseData) => {
  sendResponse({});
  return Promise.resolve(responseData);
};

const uiPorts = new Map();
const messageTypes = new Map([["settings", "settings.respond"]]);

function sendMessage(type, action, ...args) {
  if (uiPorts.size === 0) {
    return;
  }

  for (const [uiPort, filters] of uiPorts) {
    const actions = filters.get(type);
    if (actions && actions.indexOf(action) !== -1) {
      uiPort.postMessage({
        type: messageTypes.get(type),
        action,
        args,
      });
    }
  }
}

function getListener(type, action) {
  return (...args) => {
    sendMessage(type, action, ...args);
  };
}

function listen(type, filters, newFilter) {
  switch (type) {
    case "settings":
      filters.set("settings", newFilter);
      break;
    default:
    // do nothing
  }
}

function onConnect(uiPort) {
  if (!isTrustedSender(uiPort.sender)) {
    return;
  }

  if (uiPort.name !== "settings") {
    return;
  }

  const filters = new Map();
  uiPorts.set(uiPort, filters);

  uiPort.onDisconnect.addListener(() => {
    uiPorts.delete(uiPort);
  });

  uiPort.onMessage.addListener((message) => {
    const [type, action] = message.type.split(".", 2);
    if (action === "listen") {
      listen(
        type,
        filters,
        message.filter,
        message,
        uiPort.sender && uiPort.sender.tab && uiPort.sender.tab.id,
      );
    }
  });
}
browser.runtime.onConnect.addListener(onConnect);

/**
 * Process messages and events related to the 'Settings' object
 *
 */
settings.onload().then(() => {
  /* eslint-disable consistent-return */
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedSender(sender)) {
      return;
    }

    const { command } = message;
    switch (command) {
      case "setSetting":
        setSetting(message.name, message.isEnabled);
        sendResponse({});
        break;
      case "isValidTheme":
        return processMessageResponse(sendResponse, isValidTheme(message.name));
      case "getABPPrefPropertyNames":
        return processMessageResponse(sendResponse, abpPrefPropertyNames);
      default:
    }
  });
  settingsNotifier.on("settings.changed", getListener("settings", "changed"));
});

/**
 * Process messages for testing purposes
 *
 */
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }

  if (message.command !== "testing.getReadyState") {
    return;
  }

  return processMessageResponse(sendResponse, getReadyState());
});

/**
 * Process messages from Popup menu and other UI components
 *
 */
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }
  const { command } = message;
  switch (command) {
    case "pageIsWhitelisted":
      sendResponse(pageIsWhitelisted(JSON.parse(message.page)));
      break;
    case "adblockIsPaused": {
      const isPaused = adblockIsPaused(message.newValue);
      sendResponse(isPaused);
      return Promise.resolve(isPaused);
    }
    case "allowlistTab": {
      sendResponse({});
      return allowlistTab(message.url);
    }
    case "getPausedFilterText":
      return processMessageResponse(sendResponse, { pausedFilterText1, pausedFilterText2 });
    case "getCurrentTabInfo":
      sendResponse({});
      return getCurrentTabInfo(false, message.tabId).then((results) => results);
    case "getUserId":
      return getUserId();
    case "updateCustomFilterCountMap":
      updateCustomFilterCountMap(message.countMap);
      sendResponse({});
      return;
    case "updateFilterLists":
      updateFilterLists();
      sendResponse({});
      return;
    case "checkUpdateProgress":
      sendResponse(checkUpdateProgress());
      return;
    case "getCustomFilterCount":
      sendResponse({ response: countCache.getCustomFilterCount(message.host) });
      return;
    case "subscriptions.has":
      return processMessageResponse(sendResponse, ewe.subscriptions.has(message.url));
    case "getUserFilters":
      sendResponse({ response: getUserFilters() });
      return;
    case "removeAllAllowlistRulesForTab":
      sendResponse({});
      return removeAllAllowlistRulesForTab(message.tabId).then((results) => results);
    case "getDebugInfo":
      sendResponse({});
      return getDebugInfo();
    case "resetBadgeText":
      sendResponse({});
      resetBadgeText();
      return;
    case "getNewBadgeTextReason":
      sendResponse({ reason: getNewBadgeTextReason() });
      return;
    case "updateButtonUIAndContextMenus":
      updateButtonUIAndContextMenus();
      sendResponse({});
      break;
    case "dataCollectionOptOut":
      sendResponse({});
      return ServerMessages.recordOptOutMessage();
    default:
  }
});

async function addCustomFilterMessageValidation(message) {
  if (await messageValidator.validateMessage(message)) {
    return addCustomFilter(message.filterTextToAdd, message.origin).then((results) => results);
  }
}

/**
 * Process the 'addCustomFilter' message the wizards, which requires verifing the
 * `addCustomFilterRandomName` property on the message matches what is current set on the global
 * name space
 *
 */
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message) => {
  if (message.command === "addCustomFilter" && message.filterTextToAdd) {
    return addCustomFilterMessageValidation(message);
  }
});

/**
 * Process messages that are sent from a content script
 *
 */
//
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isTrustedSenderDomain(sender) || isTrustedSender(sender)) {
    const { command } = message;
    switch (command) {
      case "subscribe":
        SubscriptionAdapter.subscribe({ adblockId: message.id });
        sendResponse({});
        break;
      case "unsubscribe":
        SubscriptionAdapter.unsubscribe({ adblockId: message.adblockId });
        sendResponse({});
        break;
      case "getIdFromURL":
        return processMessageResponse(sendResponse, SubscriptionAdapter.getIdFromURL(message.url));
      case "isLanguageSpecific":
        return processMessageResponse(
          sendResponse,
          SubscriptionAdapter.isLanguageSpecific(message.adblockId),
        );
      case "getSubscriptionsMinusText":
        return processMessageResponse(
          sendResponse,
          SubscriptionAdapter.getSubscriptionsMinusText(),
        );
      case "getAllSubscriptionsMinusText":
        return processMessageResponse(
          sendResponse,
          SubscriptionAdapter.getAllSubscriptionsMinusText(),
        );
      case "recordGeneralMessage":
        ServerMessages.recordGeneralMessage(message.msg, undefined, message.additionalParams);
        sendResponse({});
        break;
      default:
    }
  }
});

/**
 * Process messages that are sent from a content script but have a custom
 * trusted sender configuration.
 *
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.command) {
    case getInfoCommand:
      if (!injectionOrigins.some((origin) => sender.url.startsWith(origin))) {
        return;
      }
      sendResponse({});
      return getInjectionInfo();
    default:
  }
});

/**
 * Process messages that are sent from a content script & trusted senders
 *
 */
//
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { command } = message;
  switch (command) {
    case "getSettings":
      sendResponse(getSettings());
      break;
    case "openTab":
      openTab(message.urlToOpen);
      sendResponse({});
      break;
    default:
  }
});

/**
 * Process messages for the DataCollectionV2
 *
 */
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }
  const { command } = message;
  switch (command) {
    case "DataCollectionV2.start":
      return processMessageResponse(sendResponse, DataCollectionV2.start());
    case "DataCollectionV2.end":
      return processMessageResponse(sendResponse, DataCollectionV2.end());
    default:
  }
});

/**
 * Process messages for the  Exclude Filters, Local Data Collection,
 * Server Messages, YT Channel & Twitch Channel Listeners
 *
 */
/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }
  const { command } = message;
  switch (command) {
    case "addYTChannelListeners":
      addYTChannelListeners();
      sendResponse({});
      break;
    case "removeYTChannelListeners":
      removeYTChannelListeners();
      sendResponse({});
      break;
    case "openYTManagedSubPage":
      openYTManagedSubPage();
      sendResponse({});
      break;
    case "addTwitchAllowlistListeners":
      addTwitchAllowlistListeners();
      sendResponse({});
      break;
    case "removeTwitchAllowlistListeners":
      removeTwitchAllowlistListeners();
      sendResponse({});
      break;
    case "recordAnonymousErrorMessage":
      ServerMessages.recordAnonymousErrorMessage(message.msg, undefined, message.additionalParams);
      sendResponse({});
      break;
    case "LocalDataCollection.clearCache":
      LocalDataCollection.clearCache();
      sendResponse({});
      break;
    case "LocalDataCollection.end":
      return processMessageResponse(sendResponse, LocalDataCollection.end());
    case "LocalDataCollection.start":
      return processMessageResponse(sendResponse, LocalDataCollection.start());
    case "LocalDataCollection.saveCacheData":
      sendResponse({});
      return LocalDataCollection.saveCacheData();
    case "LocalDataCollection.easyPrivacyURL":
      return processMessageResponse(sendResponse, LocalDataCollection.easyPrivacyURL);
    case "LocalDataCollection.EXT_STATS_KEY":
      return processMessageResponse(sendResponse, LocalDataCollection.EXT_STATS_KEY);
    case "ExcludeFilter.setExcludeFilters":
      ExcludeFilter.setExcludeFilters(message.filters);
      sendResponse({});
      break;
    default:
  }
});

function parseFilter(text) {
  const filterText = text.trim() || null;
  let error = null;

  if (filterText) {
    if (filterText[0] === "[") {
      error = { type: "unexpected_filter_list_header" };
    } else {
      const filterError = ewe.filters.validate(filterText);
      if (filterError) {
        error = toPlainFilterError(filterError);
      }
    }
  }

  return [filterText, error];
}

function filtersValidate(text) {
  const filters = [];
  const errors = [];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const [filter, error] = parseFilter(lines[i]);

    if (error) {
      error.filter = filter;
      // We don't treat filter headers like invalid filters,
      // instead we simply ignore them and don't show any errors
      // in order to allow pasting complete filter lists.
      // If there are no filters, we do treat it as an invalid filter
      // to inform users about it and to give them a chance to edit it.
      if (error.type === "unexpected_filter_list_header" && lines.length > 1) {
        /* eslint-disable no-continue */
        continue;
      }
      errors.push(error);
    } else if (filter) {
      filters.push(filter);
    }
  }

  return [filters, errors];
}

async function filtersAdd(text, origin) {
  const filters = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const [filter, error] = parseFilter(lines[i]);

    if (error) {
      return error;
    }

    if (filter) {
      filters.push(filter);
    }
  }
  try {
    await ewe.filters.add(filters, createFilterMetaData(origin));
  } catch (error) {
    return error;
  }
}

/* eslint-disable consistent-return */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }
  const { command } = message;
  switch (command) {
    case "filters.validate": {
      const [, validationErrors] = filtersValidate(message.text);
      return processMessageResponse(sendResponse, validationErrors);
    }
    case "filters.normalize": {
      return processMessageResponse(sendResponse, ewe.filters.normalize(message.text));
    }
    case "filters.add": {
      sendResponse({});
      return filtersAdd(message.text, message.origin);
    }
    case "filters.remove":
      ewe.filters.remove(message.filters);
      sendResponse({});
      break;
    default:
  }
});
