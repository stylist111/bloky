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
/* global browser, ext, isTrustedSender
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { port } from "../../adblockplusui/adblockpluschrome/lib/messaging/port";

import { License, replacedCounts, channels } from "../picreplacement/check";
import { channelsNotifier } from "../picreplacement/channels";

/**
 * Process events related to the Premium object - License, Channels, and Sync-Service
 *
 */
const uiPorts = new Map();
const messageTypes = new Map([
  ["license", "license.respond"],
  ["channels", "channels.respond"],
  ["sync", "sync.respond"],
]);

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
    case "license":
      filters.set("license", newFilter);
      break;
    case "channels":
      filters.set("channels", newFilter);
      break;
    case "sync":
      filters.set("sync", newFilter);
      break;
    default:
    // do nothing
  }
}

function onConnect(uiPort) {
  if (!isTrustedSender(uiPort.sender)) {
    return;
  }

  if (uiPort.name !== "premium") {
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

const injectScript = async function (scriptFileName, tabId, frameId) {
  try {
    if (browser.scripting) {
      await browser.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        files: [scriptFileName],
      });
    } else {
      await browser.tabs.executeScript(tabId, {
        file: scriptFileName,
        frameId,
        runAt: "document_start",
      });
    }
  } catch (error) {
    /* eslint-disable-next-line no-console */
    console.error(error);
  }
};

/**
 * Return an a clone of some the methods of the License object
 * to be used as a proxy on the Options page
 *
 * @returns a clone of the License object
 */
async function getPremiumAssociatedObject() {
  return {
    getFormattedActiveSinceDate: await License.getFormattedActiveSinceDate(),
    MAB_CONFIG: License.MAB_CONFIG,
    shouldShowMyAdBlockEnrollment: await License.shouldShowMyAdBlockEnrollment(),
    shouldShowPremiumCTA: License.shouldShowPremiumCTA(),
    isActiveLicense: await License.isActiveLicense(),
    isLicenseCodeValid: License.isLicenseCodeValid(),
    pageReloadedOnSettingChangeKey: License.pageReloadedOnSettingChangeKey,
    themesForCTA: License.userSawSyncCTAKey,
  };
}

/**
 * Return a boolean to indicate the License state
 *
 * @returns a Promise containing a boolean to indicate License state
 */
const processIsActiveLicense = async () => {
  await License.ready();
  return License.isActiveLicense();
};

/**
 * Return a Promise containing a clone of some the methods and data of the License object
 *
 * @returns a Promise containing a clone of some the methods and data of the License object
 */
const processLicenseConfig = async () => {
  try {
    await License.ready();
    const response = await getPremiumAssociatedObject();
    Object.assign(response, License.get());
    return response;
  } catch (e) {
    /* eslint-disable-next-line no-console */
    console.error("error occurred during adblock:getLicenseConfig message handling");
    /* eslint-disable-next-line no-console */
    console.error(e);
  }
  return {};
};

/**
 * Process the 'load_my_adblock' messages when the user is subscribed to
 * the Distraction Control filter list
 */
port.on("adblock:load_my_adblock", async (message, sender) => {
  await License.ready();
  if (
    (await License.isActiveLicense()) &&
    sender.page &&
    sender.page.url &&
    sender.page.url.href &&
    sender.page.url.href.startsWith("http") &&
    ((await ewe.subscriptions.has("https://cdn.adblockcdn.com/filters/distraction-control.txt")) ||
      (await ewe.subscriptions.has(
        "https://easylist-downloads.adblockplus.org/v3/full/adblock_premium.txt",
      ))) &&
    !(await ewe.filters.getAllowingFilters(sender.page.id)).length
  ) {
    void injectScript("adblock-push-notification-cs.js", sender.page.id, sender.frame.id);
  }
  return {};
});
ext.addTrustedMessageTypes(null, ["adblock:load_my_adblock"]);

/**
 * Process general messages related to the 'License' object,
 * which require sender validation. (These may come from extension pages,
 * where the sender URL starts with the extension URL)
 *
 */
port.on("adblock:cleanUpSevenDayAlarm", async () => {
  await License.ready();
  License.cleanUpSevenDayAlarm();
  return {};
});
port.on("adblock:getLicenseConfig", () => processLicenseConfig());

/**
 * Process messages related to the 'License' object
 * which require domain validation
 * the messages come from content scripts on the getadblock.com domain
 *
 */
port.on("adblock:isActiveLicense", processIsActiveLicense);

ext.addTrustedMessageTypes(null, ["adblock:isActiveLicense"]);

/**
 * Process the messages related to Channels object
 *
 */
port.on("adblock:channels.disableAllChannels", () => channels.disableAllChannels());
port.on("adblock:channels.getGuide", () => channels.getGuide());
port.on("adblock:channels.getIdByName", (message) => channels.getIdByName(message.name));
port.on("adblock:channels.initializeListeners", () => channels.initializeListeners());
port.on("adblock:channels.isAnyEnabled", () => channels.isAnyEnabled());
port.on("adblock:channels.isCustomChannelEnabled", () => channels.isCustomChannelEnabled());
port.on("adblock:channels.setEnabled", (message) =>
  channels.setEnabled(message.channelId, message.enabled),
);

/**
 * Return a Promise containing an object
 * - to indicate that Image Swap is disable on the page
 * - the Image Swap meta data
 *
 * @returns a Promise containing a boolean to indicate License state
 */
const processGetRandomlisting = async function (message, sender) {
  try {
    if ((await ewe.filters.getAllowingFilters(sender.page.id)).length) {
      return { disabledOnPage: true };
    }
    await License.ready();
    if (!(await License.isActiveLicense())) {
      return { disabledOnPage: true };
    }
    const result = channels.randomListing(message.opts);
    if (result) {
      return result;
    }
    return { disabledOnPage: true };
  } catch (e) {
    /* eslint-disable-next-line no-console */
    console.error("error occurred during getrandomlisting message handling");
    /* eslint-disable-next-line no-console */
    console.error(e);
    return { disabledOnPage: true };
  }
};

/**
 * Process the `getrandomlisting` &
 * 'channels.recordOneAdReplaced' message from the Image Swap content script
 *
 */
port.on("adblock:channels.getrandomlisting", (message, sender) =>
  processGetRandomlisting(message, sender),
);
port.on("adblock:channels.recordOneAdReplaced", async (message, sender) => {
  await License.ready();
  if (await License.isActiveLicense()) {
    replacedCounts.recordOneAdReplaced(sender.page.id);
  }
});
ext.addTrustedMessageTypes(null, [
  "adblock:channels.getrandomlisting",
  "adblock:channels.recordOneAdReplaced",
]);

/**
 * Process the messages related to Custom channel object
 *
 */
port.on("adblock:customchannel.isMaximumAllowedImages", () => {
  const customChannelId = channels.getIdByName("CustomChannel");
  const customChannel = channels.channelGuide[customChannelId].channel;
  return customChannel.isMaximumAllowedImages();
});
port.on("adblock:customchannel.getListings", () => {
  const customChannelId = channels.getIdByName("CustomChannel");
  const customChannel = channels.channelGuide[customChannelId].channel;
  return customChannel.getListings();
});
port.on("adblock:customchannel.addCustomImage", (message) => {
  const customChannelId = channels.getIdByName("CustomChannel");
  const customChannel = channels.channelGuide[customChannelId].channel;
  return customChannel.addCustomImage(message.imageInfo);
});
port.on("adblock:customchannel.removeListingByURL", (message) => {
  const customChannelId = channels.getIdByName("CustomChannel");
  const customChannel = channels.channelGuide[customChannelId].channel;
  return customChannel.removeListingByURL(message.url);
});

/**
 * Add the listener related to the Channels notifier
 */
function addChannelsNotifierListeners() {
  channelsNotifier.on("channels.changed", getListener("channels", "changed"));
}

/**
 * Add the listener related to the License notifier
 */
function addLicenseNotifierListeners() {
  License.ready().then(() => {
    License.licenseNotifier.on("license.updated", getListener("license", "updated"));
    License.licenseNotifier.on("license.expired", getListener("license", "expired"));
  });
}

function start() {
  addChannelsNotifierListeners();
  addLicenseNotifierListeners();
}

start();
