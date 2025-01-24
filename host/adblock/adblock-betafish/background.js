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
/* global browser, ext, twitchChannelNamePages, ytChannelNamePages */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import * as info from "info";
import { start as startYtWallDetection } from "@eyeo-fragments/yt-wall-detection/background";
import { start as startPublicAPI } from "@eyeo-fragments/public-api";
import { Prefs } from "./alias/prefs";

import { getCustomFilterMetaData, getDebugInfo } from "./debug/background";
import { getUserFilters } from "./filter-utils";
import {
  isTabTemporaryAllowlisted,
  adblockIsPaused,
  pausedFilterText1,
  pausedFilterText2,
} from "../src/pause/background";
import { start as startContentFiltering } from "./alias/contentFiltering";
import { NEW_BADGE_REASONS, getNewBadgeTextReason, showIconBadgeCTA } from "./alias/icon";

import { getUserId } from "./id/background/index";
import { initialize } from "./alias/subscriptionInit";
import {
  IPM as IPMTelemetry,
  TELEMETRY,
  startCdpOptOutListener,
  startTelemetryOptOutListener,
} from "./telemetry/background";
import { getBlockedPerPage, Stats } from "../adblockplusui/adblockpluschrome/lib/stats";
import { getSettings, settings } from "./prefs/background";
import { License, channels } from "./picreplacement/check";
import { revalidateAllowlistingStates } from "../adblockplusui/adblockpluschrome/lib/allowlisting";
import { setUninstallURL } from "./alias/uninstall";

import DataCollectionV2 from "./datacollection.v2";
import LocalDataCollection from "./localdatacollection";
import * as logger from "~/utilities/background";
import { port } from "../adblockplusui/adblockpluschrome/lib/messaging/port";
import ServerMessages from "~/servermessages";
import SubscriptionAdapter from "./subscriptionadapter";
import SyncService from "./picreplacement/sync-service";
import * as prefs from "./prefs/background";
import { FilterOrigin } from "../src/filters/shared";
import { start as startFiltersMigration } from "../src/filters/background";

import {
  createFilterMetaData,
  chromeStorageSetHelper,
  determineUserLanguage,
  parseUri,
} from "./utilities/background/bg-functions";

// Message verification
const trustedBaseUrl = browser.runtime.getURL("");
const gabHostnames = [
  "https://getadblock.com",
  "https://dev.getadblock.com",
  "https://dev1.getadblock.com",
  "https://dev2.getadblock.com",
  "https://vpn.getadblock.com",
  "https://help.getadblock.com",
];

const isTrustedSender = (sender) => sender.url.startsWith(trustedBaseUrl);

const isTrustedTarget = (url) =>
  url.startsWith(trustedBaseUrl) || gabHostnames.includes(new URL(url).origin);

const isTrustedSenderDomain = (sender) => {
  if (sender.origin) {
    return gabHostnames.includes(sender.origin);
  }
  if (sender.url) {
    return gabHostnames.includes(new URL(sender.url).origin);
  }
  return false;
};
const adblocBetaID = "pljaalgmajnlogcgiohkhdmgpomjcihk";

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  Prefs,
  info,
  getBlockedPerPage,
  SyncService,
  LocalDataCollection,
  ServerMessages,
  SubscriptionAdapter,
  TELEMETRY,
  IPMTelemetry,
  DataCollectionV2,
  getNewBadgeTextReason,
  ewe,
  License,
  channels,
  isTrustedSender,
  isTrustedTarget,
  isTrustedSenderDomain,
});

// CUSTOM FILTERS

const isSelectorFilter = function (text) {
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /#@?#./.test(text);
};

// custom filter countCache singleton.
const countCache = (function countCache() {
  let cache;

  // Update custom filter count stored in storage
  const updateCustomFilterCount = function () {
    chromeStorageSetHelper("custom_filter_count", cache);
  };

  return {
    // Update custom filter count cache and value stored in storage.
    // Inputs: new_count_map:count map - count map to replace existing count
    // cache
    updateCustomFilterCountMap(newCountMap) {
      cache = newCountMap || cache;
      updateCustomFilterCount();
    },

    // Remove custom filter count for host
    // Inputs: host:string - url of the host
    removeCustomFilterCount(host) {
      if (host && cache[host]) {
        delete cache[host];
        updateCustomFilterCount();
      }
    },

    // Get current custom filter count for a particular domain
    // Inputs: host:string - url of the host
    getCustomFilterCount(host) {
      let customCount = 0;
      if (cache) {
        customCount = cache[host];
      }
      return customCount || 0;
    },

    // Add 1 to custom filter count for the filters domain.
    // Inputs: filter:string - line of text to be added to custom filters.
    addCustomFilterCount(filter) {
      const host = filter.split("##")[0];
      cache[host] = this.getCustomFilterCount(host) + 1;
      updateCustomFilterCount();
    },

    init() {
      browser.storage.local.get("custom_filter_count").then((response) => {
        cache = response.custom_filter_count || {};
      });
    },
  };
})();
countCache.init();

const isAllowlistFilter = function (text) {
  return /^@@/.test(text);
};

// Add a new custom filter entry.
// Inputs: filter:string - line of text to add to custom filters.
//         origin:string - the source or trigger for the filter list entry
// Returns: null if succesfull, otherwise an exception
const addCustomFilter = async function (filterText, origin) {
  try {
    const response = ewe.filters.validate(filterText);
    if (response) {
      return response;
    }

    const metadata = createFilterMetaData(origin);
    if (
      isAllowlistFilter(filterText) &&
      [FilterOrigin.wizard, FilterOrigin.youtube, FilterOrigin.popup].includes(origin)
    ) {
      const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
      metadata.expiresAt = Date.now() + autoExtendMs;
      metadata.autoExtendMs = autoExtendMs;
    }

    await ewe.filters.add([filterText], metadata);
    await ewe.filters.enable([filterText]);
    if (isSelectorFilter(filterText)) {
      countCache.addCustomFilterCount(filterText);
    }
    return null;
  } catch (ex) {
    // convert to a string so that Safari can pass
    // it back to content scripts
    return ex.toString();
  }
};

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
const removeCustomFilter = async function (host) {
  const customFilters = await getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return;
  }

  const identifier = host;

  for (let i = 0; i < customFilters.length; i++) {
    const entry = customFilters[i];
    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.text.indexOf(identifier) === 0) {
      ewe.filters.remove([entry.text]);
    }
  }
};

// Entry point for customize.js, used to update custom filter count cache.
const updateCustomFilterCountMap = function (newCountMap) {
  // Firefox passes weak references to objects, so we need a local copy
  const localCountMap = JSON.parse(JSON.stringify(newCountMap));
  countCache.updateCustomFilterCountMap(localCountMap);
};

const removeCustomFilterForHost = function (host) {
  if (countCache.getCustomFilterCount(host)) {
    removeCustomFilter(host);
    countCache.removeCustomFilterCount(host);
  }
};

// Currently, Firefox doesn't allow the background page to use alert() or confirm(),
// so some JavaScript is injected into the active tab, which does the confirmation for us.
// If the user confirms the removal of the entries, then they are removed, and the page reloaded.
const confirmRemovalOfCustomFiltersOnHost = function (host, activeTabId) {
  if (!browser.tabs.executeScript) {
    /* eslint-disable-next-line no-console */
    console.error("confirmRemovalOfCustomFiltersOnHost disable for MV3 extensions");
    return; // this function isn't supported under MV3, and shouldn't be invoked for MV3 extensions.
  }
  const customFilterCount = countCache.getCustomFilterCount(host);
  const confirmationText = browser.i18n.getMessage("confirm_undo_custom_filters", [
    customFilterCount,
    host,
  ]);
  const messageListenerFN = function (request) {
    browser.runtime.onMessage.removeListener(messageListenerFN);
    if (request === `remove_custom_filters_on_host${host}:true`) {
      removeCustomFilterForHost(host);
      browser.tabs.reload(activeTabId);
    }
  };

  browser.runtime.onMessage.addListener(messageListenerFN);
  /* eslint-disable prefer-template */
  const codeToExecute =
    'var host = "' +
    host +
    '"; var confirmResponse = confirm("' +
    confirmationText +
    '"); browser.runtime.sendMessage("remove_custom_filters_on_host" + host + ":" + confirmResponse); ';
  const details = { allFrames: false, code: codeToExecute };
  browser.tabs.executeScript(activeTabId, details);
};
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message.command !== "confirmRemovalOfCustomFiltersOnHost" ||
    !message.host ||
    !message.activeTabId
  ) {
    return;
  }
  confirmRemovalOfCustomFiltersOnHost(message.host, message.activeTabId);
  sendResponse({});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== "removeCustomFilterForHost" || !message.host) {
    return;
  }
  removeCustomFilterForHost(message.host);
  sendResponse({});
});

// Reload already opened tab
// Input:
// id: integer - id of the tab which should be reloaded
const reloadTab = function (id, callback) {
  let tabId = id;
  const localCallback = callback;
  const listener = function (updatedTabId, changeInfo, tab) {
    if (changeInfo.status === "complete" && tab.status === "complete") {
      setTimeout(() => {
        browser.tabs.sendMessage(updatedTabId, { command: "reloadcomplete" });
        if (typeof localCallback === "function") {
          localCallback(tab);
        }
        browser.tabs.onUpdated.removeListener(listener);
      }, 2000);
    }
  };

  if (typeof tabId === "string") {
    tabId = parseInt(tabId, 10);
  }
  browser.tabs.onUpdated.addListener(listener);
  browser.tabs.reload(tabId, { bypassCache: true });
};

const isSelectorExcludeFilter = function (text) {
  return /#@#./.test(text);
};

const getAdblockUserId = async function () {
  return getUserId();
};

// INFO ABOUT CURRENT PAGE

// Returns true if the url cannot be blocked
const pageIsUnblockable = function (url) {
  if (!url) {
    // Protect against empty URLs - e.g. Safari empty/bookmarks/top sites page
    return true;
  }
  let scheme = "";
  if (!url.protocol) {
    scheme = parseUri(url).protocol;
  } else {
    scheme = url.protocol;
  }

  return scheme !== "http:" && scheme !== "https:" && scheme !== "feed:";
};

// Returns true if the page is whitelisted.
// Called from a content script
const pageIsWhitelisted = async function (page) {
  const whitelisted = !!(await ewe.filters.getAllowingFilters(page.id).length);
  return whitelisted !== undefined && whitelisted !== null;
};

const getTab = function (tabId) {
  return new Promise((resolve) => {
    if (tabId) {
      let id = tabId;
      if (typeof id === "string") {
        id = parseInt(id, 10);
      }
      browser.tabs.get(id).then((tab) => {
        resolve(tab);
      });
    } else {
      browser.tabs
        .query({
          active: true,
          lastFocusedWindow: true,
        })
        .then((tabs) => {
          if (tabs.length === 0) {
            resolve(); // For example: only the background devtools or a popup are opened
          }
          resolve(tabs[0]);
        });
    }
  });
};

// Get interesting information about the current tab.
// Inputs:
// secondTime: bool - whether this is a recursive call
// info object passed to resolve: {
// page: Page object
// tab: Tab object
// whitelisted: bool - whether the current tab's URL is whitelisted.
// disabled_site: bool - true if the url is e.g. about:blank or the
// Extension Gallery, where extensions don't run.
// settings: Settings object
// paused: bool - whether AdBlock is paused
// domainPaused: bool - whether the current tab's URL is paused
// blockCountPage: int - number of ads blocked on the current page
// blockCountTotal: int - total number of ads blocked since install
// customFilterCount: int - number of custom rules for the current tab's URL
// showMABEnrollment: bool - whether to show MAB enrollment
// popupMenuThemeCTA: string - name of current popup menu CTA theme
// lastGetStatusCode: int - status code for last GET request
// lastGetErrorResponse: error object - error response for last GET request
// lastPostStatusCode: int - status code for last POST request
// allowlistRuleText: string - allowlist rule text for use on YouTube and Twitch
// }
// Returns: Promise
const getCurrentTabInfo = function (secondTime, tabId) {
  return new Promise((resolve) => {
    getTab(tabId).then(async (tab) => {
      if (tab && !tab.url) {
        // Issue 6877: tab URL is not set directly after you opened a window
        // using window.open()
        if (!secondTime) {
          setTimeout(() => {
            getCurrentTabInfo(true);
          }, 250);
        }
        return resolve();
      }
      try {
        const page = new ext.Page(tab);
        const disabledSite = pageIsUnblockable(page.url.href);
        const customFilterCheckUrl = disabledSite ? undefined : page.url.hostname;
        const result = {
          disabledSite,
          url: String(page.url || tab.url),
          id: page.id,
          settings: getSettings(),
          paused: adblockIsPaused(),
          domainPaused: await isTabTemporaryAllowlisted(page.id),
          blockCountPage: await getBlockedPerPage(tab),
          blockCountTotal: Stats.blocked_total,
          customFilterCount: countCache.getCustomFilterCount(customFilterCheckUrl),
          showMABEnrollment: License.shouldShowMyAdBlockEnrollment(),
          popupMenuThemeCTA: License.getCurrentPopupMenuThemeCTA(),
          showDcCTA: License.shouldShowPremiumDcCTA(),
          lastGetStatusCode: SyncService.getLastGetStatusCode(),
          lastGetErrorResponse: SyncService.getLastGetErrorResponse(),
          lastPostStatusCode: SyncService.getLastPostStatusCode(),
          newBadgeTextReason: getNewBadgeTextReason(),
          premiumPayURL: License.MAB_CONFIG.payURL,
        };
        if (!disabledSite) {
          result.whitelisted = !!(await ewe.filters.getAllowingFilters(page.id)).length;
          result.whitelistedText = await ewe.filters.getAllowingFilters(page.id);
        }
        if (License && License.isActiveLicense()) {
          result.activeLicense = true;
          result.subscriptions = await SubscriptionAdapter.getSubscriptionsMinusText();
        }
        if (
          getSettings() &&
          getSettings().youtube_channel_whitelist &&
          parseUri(tab.url).hostname === "www.youtube.com"
        ) {
          result.youTubeChannelName = ytChannelNamePages.get(page.id);
          // handle the odd occurence of when the  YT Channel Name
          // isn't available in the ytChannelNamePages map
          // obtain the channel name from the URL
          // for instance, when the forward / back button is clicked
          if (!result.youTubeChannelName && /ab_channel/.test(tab.url)) {
            result.youTubeChannelName = parseUri.parseSearch(tab.url).ab_channel;
          }
          if (result.youTubeChannelName) {
            result.allowlistRuleText = `@@||www.youtube.com/*${result.youTubeChannelName}|$document`;
          }
        }
        if (
          twitchChannelNamePages &&
          getSettings() &&
          getSettings().twitch_channel_allowlist &&
          parseUri(tab.url).hostname === "www.twitch.tv"
        ) {
          result.twitchChannelName = twitchChannelNamePages.get(page.id);
          if (result.twitchChannelName) {
            result.allowlistRuleText = `@@||twitch.tv/*${result.twitchChannelName}^$document`;
          }
        }
        return resolve(result);
      } catch (err) {
        return resolve({ errorStr: err.toString(), stack: err.stack, message: err.message });
      }
    });
  });
};

const premiumCtaViewed = "premium_cta_viewed";
const versionStorageKey = "last_known_version";
const isUpdatePageEngaged = true;

const showUpdatePage = async function (details) {
  let updateTabRetryCount = 0;

  const getUpdatedURL = async function () {
    const userID = await getUserId();
    const updatedURL = new URL("https://getadblock.com/update/");
    updatedURL.searchParams.append("f", TELEMETRY.flavor.toLowerCase());
    updatedURL.searchParams.append("version", browser.runtime.getManifest().version);
    updatedURL.searchParams.append("u", userID);
    updatedURL.searchParams.append("bc", Prefs.blocked_total);
    updatedURL.searchParams.append("rt", updateTabRetryCount);
    return updatedURL.href;
  };

  const waitForUserAction = function () {
    browser.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(() => {
      updateTabRetryCount += 1;
      // eslint-disable-next-line no-use-before-define
      openUpdatedPage();
    }, 10000); // 10 seconds
  };

  const openUpdatedPage = async function () {
    const updatedURL = await getUpdatedURL();
    browser.tabs.create({ url: updatedURL });
  };

  const shouldShowUpdate = async function () {
    const checkQueryState = async function () {
      const state = await browser.idle.queryState(30);
      if (state === "active") {
        openUpdatedPage();
      } else {
        browser.tabs.onCreated.removeListener(waitForUserAction);
        browser.tabs.onCreated.addListener(waitForUserAction);
      }
    };

    const checkLicense = function () {
      if (!License.isActiveLicense()) {
        checkQueryState();
      }
    };

    const extensionInfo = await browser.management.getSelf();
    if (extensionInfo.installType !== "admin") {
      await License.ready();
      checkLicense();
    }
  };

  // only open the /update page for English, French, German, Spanish and Brazilian/Portugese users.
  const shouldShowUpdateForLocale = function () {
    const slashUpdateLanguages = ["en", "fr", "de", "es", "nl"];
    const locale = determineUserLanguage();
    const language = locale.substring(0, 2);
    return slashUpdateLanguages.includes(language);
  };

  if (
    details.reason === "update" &&
    info.platform === "gecko" &&
    shouldShowUpdateForLocale() &&
    browser.runtime.id !== adblocBetaID
  ) {
    await settings.onload();
    if (!getSettings().suppress_update_page) {
      await getUserId();
      await Prefs.untilLoaded;
      shouldShowUpdate();
    }
  }
};

/*
  If we call browser.storage.local.get with an undefined key, we get the whole list back.
  This function passes false as the default result if the key does not exist,
  so it works as we expect when checking for defined properties on an object.
*/
const getValueOrFalse = async (key) => {
  const result = await browser.storage.local.get({ [key]: false });
  return result[key];
};

browser.runtime.onInstalled.addListener(async (details) => {
  // Display beta page after each update for beta-users only
  if (
    (details.reason === "update" || details.reason === "install") &&
    browser.runtime.id === adblocBetaID
  ) {
    browser.tabs.create({ url: "https://getadblock.com/beta" });
  }

  // Show the new callout to everyone for the new premium popup until they click
  const alreadyViewedCta = await getValueOrFalse(premiumCtaViewed);
  if (details.reason === "update" && !alreadyViewedCta) {
    await showIconBadgeCTA(NEW_BADGE_REASONS.UPDATE_FOR_EVERYONE);
    void browser.storage.local.set({ [premiumCtaViewed]: true });
  }

  // We want to move away from localStorage, so remove item if it exists.
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(versionStorageKey);
  }

  if (isUpdatePageEngaged) {
    await showUpdatePage(details);
  }
  // Update version in browser.storage.local.
  void browser.storage.local.set({ [versionStorageKey]: browser.runtime.getManifest().version });
});

const openTab = function (url) {
  browser.tabs.create({ url });
};

// Called when user explicitly requests filter list updates
async function updateFilterLists() {
  const subscriptions = await ewe.subscriptions.getSubscriptions();
  subscriptions.forEach(async (subscription) => {
    await ewe.subscriptions.sync(subscription.url);
  });
}

// Checks if the filter lists are currently in the process of
// updating and if there were errors the last time they were
// updated
async function checkUpdateProgress() {
  let inProgress = false;
  let filterError = false;
  const subscriptions = await ewe.subscriptions.getSubscriptions();
  subscriptions.forEach(async (subscription) => {
    if (subscription.downloading) {
      inProgress = true;
    } else if (subscription.downloadStatus && subscription.downloadStatus !== "synchronize_ok") {
      filterError = true;
    }
  });
  return { inProgress, filterError };
}

/*
 * Listens on allowlisting events and logs when an allowlisting
 * filter was renewed or expired.
 */
function addAllowlistingListeners() {
  // Log event when a smart allowlist was renewed
  ewe.filters.onRenewed.addListener((filter) => {
    ServerMessages.recordAllowlistEvent("allowlisting_renewed", filter.metadata.autoExtendMs);
  });

  // Log event when a smart allowlist expired
  ewe.filters.onExpired.addListener((filter) => {
    const { autoExtendMs } = filter.metadata;

    if (autoExtendMs) {
      ServerMessages.recordAllowlistEvent("allowlisting_expired", autoExtendMs);
    }
  });
}

initialize
  .then(async () => {
    await startContentFiltering();
    await getUserId();
    TELEMETRY.start();
    setUninstallURL();
    await IPMTelemetry.untilLoaded();
    IPMTelemetry.start();
    await startTelemetryOptOutListener();
    await startCdpOptOutListener();
    revalidateAllowlistingStates();
    prefs.migrateUserData();
    startYtWallDetection({
      addTrustedMessageTypes: ext.addTrustedMessageTypes,
      ewe,
      logger,
      port,
      prefs: Prefs,
      sendAdWallEvents: ServerMessages.recordAdWallMessage,
    });
    startPublicAPI({
      ewe,
      port,
      addTrustedMessageTypes: ext.addTrustedMessageTypes,
      isPremiumActive: License.isActiveLicense,
      getEncodedLicense: License.getBypassPayload,
    });
    addAllowlistingListeners();
    await startFiltersMigration();
  })
  .catch((e) => {
    const hasInternalError = /internal error/i.test(e.message);
    if (hasInternalError) {
      // Send the error message to the log server when internal error occurs.
      // We want to know the amount of users that are affected by this issue,
      // as well which rulesets are affected. The ruleset id will be added to
      // the error message by the WebExt SDK.
      ServerMessages.recordErrorMessage("internal_error", {
        errorMsg: e.message,
      });
    } else {
      // Send anonymous event to the log server in case there was an error with
      // initializing the extension.
      ServerMessages.recordAnonymousErrorMessage("initialization_error");
    }
    throw e;
  });

// Create the "blockage stats" for the uninstall logic ...
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    browser.storage.local.get("blockage_stats").then((response) => {
      const { blockage_stats } = response;
      if (!blockage_stats) {
        const data = {};
        data.start = Date.now();
        data.version = 1;
        chromeStorageSetHelper("blockage_stats", data);
      }
    });
  }
});

// Attach methods to window
// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  adblockIsPaused,
  getUserFilters,
  updateFilterLists,
  checkUpdateProgress,
  getDebugInfo,
  openTab,
  pageIsWhitelisted,
  pageIsUnblockable,
  getCurrentTabInfo,
  getAdblockUserId,
  addCustomFilter,
  removeCustomFilter,
  countCache,
  updateCustomFilterCountMap,
  removeCustomFilterForHost,
  reloadTab,
  isSelectorFilter,
  isAllowlistFilter,
  isSelectorExcludeFilter,
  pausedFilterText1,
  pausedFilterText2,
  versionStorageKey,
  getCustomFilterMetaData,
});
