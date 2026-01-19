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
/* global browser, ext, reloadTab, getSettings, */

import { Prefs } from "prefs";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  adblockIsPaused,
  allowlistTab,
  removeAllAllowlistRulesForTab,
} from "../src/pause/background";
import { FilterOrigin } from "../src/filters/shared";
import { setBadge } from "../adblockplusui/adblockpluschrome/lib/action";
import ServerMessages from "./servermessages";
import { log } from "./utilities/background/bg-functions";

import messageValidator from "./messaging/messagevalidator";

const updateBadge = async function (tab) {
  if (!tab || !tab.active) {
    return;
  }

  if ((await adblockIsPaused()) || !!(await ewe.filters.getAllowingFilters(tab.id)).length) {
    setBadge(tab.id, { number: "" });
  }
};

const updateContextMenus = function (tab) {
  if (tab && tab.active) {
    const page = new ext.Page(tab);
    // eslint-disable-next-line no-use-before-define
    updateContextMenuItems(page);
  }
};

const updateButtonUIAndContextMenus = async function (tabArg) {
  if (tabArg) {
    updateBadge(tabArg);
    updateContextMenus(tabArg);
    return;
  }
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    updateBadge(tab);
    updateContextMenus(tab);
  }
};

// Bounce messages back to content scripts.
const emitPageBroadcast = (function emitBroadcast() {
  const injectMap = {
    topOpenWhitelistUI: {
      allFrames: false,
      include: [
        "jquery-3.5.1.min.js",
        "globals-front.js",
        "adblock-uiscripts-load_wizard_resources.js",
        "adblock-uiscripts-top_open_whitelist_ui.js",
      ],
    },
    topOpenWhitelistCompletionUI: {
      allFrames: false,
      include: [
        "jquery-3.5.1.min.js",
        "globals-front.js",
        "adblock-uiscripts-load_wizard_resources.js",
        "adblock-uiscripts-top_open_whitelist_completion_ui.js",
      ],
    },
    topOpenBlacklistUI: {
      allFrames: false,
      include: [
        "jquery-3.5.1.min.js",
        "purify.min.js",
        "globals-front.js",
        "adblock-uiscripts-load_wizard_resources.js",
        "adblock-uiscripts-blacklisting-overlay.js",
        "adblock-uiscripts-blacklisting-clickwatcher.js",
        "adblock-uiscripts-blacklisting-elementchain.js",
        "adblock-uiscripts-blacklisting-blacklistui.js",
        "adblock-uiscripts-top_open_blacklist_ui.js",
      ],
    },
    sendContentToBack: {
      allFrames: true,
      include: ["adblock-uiscripts-send_content_to_back.js"],
    },
  };

  // Inject the required scripts to execute fnName(parameter) in
  // the given tab.
  // Inputs: fnName:string name of function to execute on tab.
  //         fnName must exist in injectMap above.
  //         parameter:object to pass to fnName.  Must be JSON.stringify()able.
  //         alreadyInjected?:int used to recursively inject required scripts.
  //         tabID:int representing the ID of the tab to execute in.
  //         tabID defaults to the active tab
  const executeOnTab = async function (fnName, parameter, alreadyInjected, tabID) {
    const injectedSoFar = alreadyInjected || 0;
    const data = injectMap[fnName];
    const details = { allFrames: data.allFrames };

    if ("scripting" in browser) {
      await browser.scripting
        .executeScript({
          target: { tabId: tabID, allFrames: data.allFrames },
          files: data.include,
        })
        .catch(log);
      const functionToExecute = (args) => {
        if (typeof window[args.fnName] === "function") {
          window[args.fnName](args);
        }
      };
      const params = parameter;
      params.fnName = fnName;
      await browser.scripting
        .executeScript({
          target: { tabId: tabID, allFrames: data.allFrames },
          args: [params],
          function: functionToExecute,
        })
        .catch(log);
      return;
    }

    // If there's anything to inject, inject the next item and recurse.
    if (data.include.length > injectedSoFar) {
      details.file = data.include[injectedSoFar];
      browser.tabs
        .executeScript(tabID, details)
        .then(() => {
          executeOnTab(fnName, parameter, injectedSoFar + 1, tabID);
        })
        .catch((error) => {
          log(error);
        });
    } else {
      // Nothing left to inject, so execute the function.
      const param = JSON.stringify(parameter);
      details.code = `${fnName}(${param});`;
      browser.tabs.executeScript(tabID, details);
    }
  };

  // The emitPageBroadcast() function
  const theFunction = function (request) {
    executeOnTab(request.fn, request.options, 0, request.tabID);
  };

  return theFunction;
})();

const serverLogger = new ewe.telemetry.ServerLogger("adblock_ui");

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info && info.menuItemId) {
    const { menuItemId } = info;
    switch (menuItemId) {
      case "pause_adblock_everywhere":
        serverLogger.behavior("cm_pause_on_all_sites");
        ServerMessages.recordGeneralMessage("cm_pause_clicked");
        await adblockIsPaused(true);
        updateButtonUIAndContextMenus(tab);
        break;
      case "resume_blocking_ads":
        serverLogger.behavior("cm_resume_adblock");
        ServerMessages.recordGeneralMessage("cm_unpause_clicked");
        await adblockIsPaused(false);
        updateButtonUIAndContextMenus(tab);
        break;
      case "resume_blocking_ads_unallow":
        serverLogger.behavior("cm_resume_adblock");
        ServerMessages.recordGeneralMessage("cm_unpause_clicked");
        await removeAllAllowlistRulesForTab(tab.id);
        updateButtonUIAndContextMenus(tab);
        break;
      case "domain_pause_adblock":
        serverLogger.behavior("cm_pause_on_site");
        ServerMessages.recordGeneralMessage("cm_domain_pause_clicked");
        await allowlistTab(tab.url, FilterOrigin.context);
        updateButtonUIAndContextMenus(tab);
        break;
      case "block_this_ad":
        emitPageBroadcast({
          fn: "topOpenBlacklistUI",
          options: {
            info,
            settings: getSettings(),
            addCustomFilterRandomName: messageValidator.generateNewRandomText(),
          },
          tabID: tab.id,
        });
        break;
      case "block_an_ad_on_this_page":
        emitPageBroadcast({
          fn: "topOpenBlacklistUI",
          options: {
            nothingClicked: true,
            settings: getSettings(),
            addCustomFilterRandomName: messageValidator.generateNewRandomText(),
          },
          tabID: tab.id,
        });
        break;
      default:
    }
  }
});

const contextMenuItem = (() => ({
  pauseAll: {
    title: browser.i18n.getMessage("pause_adblock_everywhere"),
    id: "pause_adblock_everywhere",
    contexts: ["all"],
  },
  unpauseAll: {
    title: browser.i18n.getMessage("resume_blocking_ads"),
    id: "resume_blocking_ads",
    contexts: ["all"],
  },
  unAllowList: {
    title: browser.i18n.getMessage("resume_blocking_ads"),
    id: "resume_blocking_ads_unallow",
    contexts: ["all"],
  },
  pauseDomain: {
    title: browser.i18n.getMessage("domain_pause_adblock"),
    id: "domain_pause_adblock",
    contexts: ["all"],
  },
  blockThisAd: {
    title: browser.i18n.getMessage("block_this_ad"),
    id: "block_this_ad",
    contexts: ["all"],
  },
  blockAnAd: {
    title: browser.i18n.getMessage("block_an_ad_on_this_page"),
    id: "block_an_ad_on_this_page",
    contexts: ["all"],
  },
}))();

const checkLastError = function () {
  if (browser.runtime.lastError) {
    // do nothing
  }
};

let updateContextMenuItems = async function (page) {
  await browser.contextMenus.removeAll();
  // Check if the context menu items should be added
  if (!Prefs.shouldShowBlockElementMenu) {
    return;
  }

  const isTabAllowlisted = !!(await ewe.filters.getAllowingFilters(page.id)).length;

  if (await adblockIsPaused()) {
    await browser.contextMenus.create(contextMenuItem.unpauseAll, checkLastError);
  } else if (isTabAllowlisted) {
    await browser.contextMenus.create(contextMenuItem.unAllowList, checkLastError);
  } else {
    await browser.contextMenus.create(contextMenuItem.blockThisAd, checkLastError);
    await browser.contextMenus.create(contextMenuItem.blockAnAd, checkLastError);
    await browser.contextMenus.create(contextMenuItem.pauseDomain, checkLastError);
    await browser.contextMenus.create(contextMenuItem.pauseAll, checkLastError);
  }
};

const updateContextMenuItemsNoOp = function () {
  // Remove the AdBlock context menu items
  browser.contextMenus.removeAll();
};
// startup test to check if the context menu API functions correctly
// the `create` function is invoked twice, because it's the second
// and all subsequent calls that fail.
try {
  browser.contextMenus.create(contextMenuItem.blockThisAd, checkLastError);
  browser.contextMenus.create(contextMenuItem.blockThisAd, checkLastError);
} catch (e) {
  updateContextMenuItems = updateContextMenuItemsNoOp;
}
browser.contextMenus.removeAll();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status) {
    updateContextMenuItems(new ext.Page(tab));
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  let tab = null;

  try {
    tab = await browser.tabs.get(activeInfo.tabId);
  } catch (ex) {
    // The tab may be closed, so we need to continue without it
  }

  updateButtonUIAndContextMenus(tab);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== "sendContentToBack") {
    return;
  } // not for us
  emitPageBroadcast({ fn: "sendContentToBack", options: {}, tabID: sender.tab.id });
  sendResponse({});
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "reloadTabForWhitelist") {
    reloadTab(sender.tab.id, () => {
      emitPageBroadcast({
        fn: "topOpenWhitelistCompletionUI",
        options: {
          rule: request.rule,
        },
        tabID: sender.tab.id,
      });
    });
    sendResponse({});
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "showWhitelistCompletion") {
    emitPageBroadcast({
      fn: "topOpenWhitelistCompletionUI",
      options: {
        rule: request.rule,
      },
      tabID: sender.tab.id,
    });
    sendResponse({});
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "showBlacklist" && typeof request.nothingClicked === "boolean") {
    emitPageBroadcast({
      fn: "topOpenBlacklistUI",
      options: {
        nothingClicked: request.nothingClicked,
        settings: getSettings(),
        addCustomFilterRandomName: messageValidator.generateNewRandomText(),
      },
      tabID: request.tabId,
    });
    sendResponse({});
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "showWhitelist") {
    emitPageBroadcast({
      fn: "topOpenWhitelistUI",
      options: {
        addCustomFilterRandomName: messageValidator.generateNewRandomText(),
      },
      tabID: request.tabId,
    });
    sendResponse({});
  }
});

// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
ewe.subscriptions.onAdded.addListener(updateButtonUIAndContextMenus);
ewe.subscriptions.onChanged.addListener(updateButtonUIAndContextMenus);
ewe.subscriptions.onRemoved.addListener(updateButtonUIAndContextMenus);

Prefs.on(Prefs.shouldShowBlockElementMenu, () => {
  updateButtonUIAndContextMenus();
});

// update the tab icon when the tab's content changes
ext.pages.onLoading.addListener(async (page) => {
  let tab;
  try {
    tab = await browser.tabs.get(page.id);
  } catch (ex) {
    // No need to continue, if tab no longer exists
    return;
  }

  updateButtonUIAndContextMenus(tab);
});

updateButtonUIAndContextMenus();

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  emitPageBroadcast,
  updateButtonUIAndContextMenus,
});
