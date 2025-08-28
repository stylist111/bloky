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
/** @module icon */
/*
 * Same as the original source adblockpluschrome/lib/icon.js
 * except:
 * - updated image file names from 'abp-' to 'adblock-'
 * - updated the 'import' paths
 * - call renderIcons() at the end of the module for all platforms,
 *   not just Chromium
 * - added the showIconBadgeCTA, getNewBadgeTextReason functions
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { TabSessionStorage } from "../../adblockplusui/adblockpluschrome/lib/storage/tab-session.js";
import { allowlistingState } from "../../adblockplusui/adblockpluschrome/lib/allowlisting";
import {
  setIconPath,
  setIconImageData,
  setBadge,
} from "../../adblockplusui/adblockpluschrome/lib/action";

import {
  chromeStorageSetHelper,
  chromeStorageGetHelper,
  chromeStorageDeleteHelper,
} from "../utilities/background/bg-functions.js";

import { FlavorType } from "~/utilities/background/user-agent-info.types";
import { getUserAgentInfo } from "~/utilities/background/index";

export const statsInIconKey = "current_show_statsinicon";

let canUpdateIcon = true;
let allowlistedByPage = new TabSessionStorage("icon:allowlisted");

let icons = [null, null];

async function loadImage(url) {
  let response = await fetch(url);
  let blob = await response.blob();
  return createImageBitmap(blob);
}

async function renderIcons() {
  let paths = [
    "icons/adblock-16.png",
    "icons/adblock-16-allowlisted.png",
    "icons/adblock-32.png",
    "icons/adblock-32-allowlisted.png",
  ];

  for (let path of paths) {
    let image = await loadImage(path);
    let [, size, allowlisted] = /\/adblock-(16|32)(-allowlisted)?\./.exec(path);

    let canvas = new OffscreenCanvas(size, size);
    let context = canvas.getContext("2d");
    let imageData = icons[!!allowlisted | 0] || {};

    context.globalAlpha = 1;
    context.drawImage(image, 0, 0);
    imageData[size] = context.getImageData(0, 0, size, size);

    icons[!!allowlisted | 0] = imageData;
  }
}

async function setIcon(page) {
  const allowlisted = !!(await allowlistedByPage.get(page.id));

  if (icons[allowlisted | 0]) {
    setIconImageData(page.id, icons[allowlisted | 0]);
  } else {
    setIconPath(page.id, "/icons/adblock-$size" + (allowlisted ? "-allowlisted" : "") + ".png");
  }
}

allowlistingState.addListener("changed", (page, isAllowlisted) => {
  void allowlistedByPage.transaction(async () => {
    const wasAllowlisted = await allowlistedByPage.get(page.id);
    if (wasAllowlisted === isAllowlisted) {
      return;
    }

    await allowlistedByPage.setFlag(page.id, isAllowlisted);
    if (canUpdateIcon) {
      await setIcon(page);
    }
  });
});

renderIcons();

/**
 * Returns the Object containing all of the reasons the text on the toolbar icon / badge is 'new'
 *
 */
export const NEW_BADGE_REASONS = {
  FREE_DC_UPDATE: "free dc update",
  SEVEN_DAY: "seven day",
  UPDATE: "update",
  UPDATE_FOR_EVERYONE: "update including premium",
  VPN_CTA: "vpn cta",
};

/**
 * Handles the display of the New badge on the toolbar icon.
 * @param {Boolean} [showBadge] true shows the badge, false removes the badge
 */

let newBadgeTextReason = "";

function setNewText(badgeTextDetails, reason = "") {
  // process all currently opened tabs
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith("http")) {
        setBadge(tab.id, badgeTextDetails);
        newBadgeTextReason = reason;
      }
    }
  });
}

export async function resetBadgeText() {
  // Restore show_statsinicon if we previously stored its value
  const storedValue = await chromeStorageGetHelper(statsInIconKey);

  if (typeof storedValue === "boolean") {
    Prefs.show_statsinicon = storedValue;
    chromeStorageDeleteHelper(statsInIconKey); // remove the data, since we no longer need it
    setNewText({ number: "" });
  }
}

function getBadgeText(userAgent) {
  // Firefox badge cutting off at 2.5 chars, so let's use an emoji
  if (userAgent === FlavorType.firefox) {
    return "💥";
  }

  const text = browser.i18n.getMessage("new_badge");

  if (text.length < 5) {
    return text.toUpperCase();
  }

  return "New".toUpperCase();
}

async function checkLicenseCTA() {
  await License.ready();
  return License.shouldShowPremiumCTA();
}

export async function showIconBadgeCTA(reason) {
  const showCTA = reason === NEW_BADGE_REASONS.UPDATE_FOR_EVERYONE || (await checkLicenseCTA());

  if (!showCTA) {
    return;
  }

  const storedValue = await chromeStorageGetHelper(statsInIconKey);
  if (!storedValue) {
    // don't overwrite the original, saved value
    chromeStorageSetHelper(statsInIconKey, Prefs.show_statsinicon);
  }

  Prefs.show_statsinicon = false;

  const { flavor } = getUserAgentInfo();
  const badgeTextDetails = {
    color: "#093aec",
    number: getBadgeText(flavor),
  };

  // wait 10 seconds to allow any other tasks to finish
  setTimeout(setNewText.bind(this, badgeTextDetails, reason), 10_000);
}

/**
 * Returns the String reason the text on the toolbar icon / badge is 'new'
 *
 */
export function getNewBadgeTextReason() {
  return newBadgeTextReason;
}
