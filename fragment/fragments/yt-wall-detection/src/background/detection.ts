/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type Browser from "webextension-polyfill";
import browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import {
  type MessageSender,
  type AdWallMessage,
  type YTRecordEventMessage,
} from "@eyeo/polyfills/all";
import {
  noop,
  type StartInfo,
  ytAllowlistStartDate,
} from "./detection.types.js";

import {
  youTubeAlreadyAllowListed,
  youTubeAutoAllowlisted,
  youTubeWallDetected,
  youTubeNavigation,
  ytRecordEvent,
  contextTamperingEvent,
  adShownEvent,
  errorEvent,
  ErrorType,
} from "../shared/index.js";

/**
 * capture the allowlist YT start date (the update or install date)
 *
 */
const captureStartDate = function (parameters: StartInfo): void {
  if (parameters.prefs.get(ytAllowlistStartDate) === 0) {
    parameters.prefs.set(ytAllowlistStartDate, Date.now());
    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    parameters.logger.debug(
      "[yt-detection]: set start date",
      new Date(parameters.prefs.get(ytAllowlistStartDate)).toLocaleDateString(),
    );
  }
};

/**
 * Capture the allowlist YT start date (the update or install date)
 *
 */
const captureDateOnUpdate = (
  parameters: StartInfo,
  details: Browser.Runtime.OnInstalledDetailsType,
): void => {
  if (details.reason === "update" || details.reason === "install") {
    captureStartDate(parameters);
  }
};

/**
 * Check if the current tab is allowlisted
 * @param {number} tabId
 */
async function hasAllowlistedFilter(
  tabId: number | undefined,
): Promise<boolean> {
  let isAllowlisted = false;

  if (typeof tabId !== "undefined") {
    const filters = await ewe.filters.getAllowingFilters(tabId);
    isAllowlisted = filters.some((f) => f.includes("youtube.com"));
  }

  return isAllowlisted;
}

/**
 * Process the YouTube Wall Detected message from the content script
 *
 */
const processYouTubeWallMessage = async (
  parameters: StartInfo,
  message: AdWallMessage,
  sender: MessageSender,
): Promise<void> => {
  const tabId = sender.tab?.id;
  const tabURL = sender.tab?.url;
  if (typeof tabId === "undefined" || typeof tabURL === "undefined") {
    return;
  }
  const { sendAdWallEvents = noop } = parameters;

  const senderURL = new URL(tabURL);
  const host = senderURL.hostname.replace(/^www\./, "");

  const allowlistUrl = host;
  const allowlistDuration = "tab";
  const filters = await ewe.filters.getAllowingFilters(tabId);
  const isAllowListed = filters.some((f) => f.includes(allowlistUrl));

  // trigger the detection event
  const eventName = isAllowListed
    ? youTubeAlreadyAllowListed
    : youTubeWallDetected;
  sendAdWallEvents(eventName, {
    category: message.hasDismiss ? "soft" : "hard",
    userLoggedIn: message.userLoggedIn ? "1" : "0",
    isAllowListed: isAllowListed ? "1" : "0",
    allowlistDuration,
  });

  // Already allowlisted, no need to add the rule;
  // maybe due to co-install of another extension
  if (isAllowListed) {
    return;
  }

  const ruleText = `@@||${allowlistUrl}^$document`;
  const metadata = {
    expiresByTabId: tabId,
    origin: "yt-auto",
    created: Date.now(),
  };
  await ewe.filters.add(ruleText, metadata);

  if (message.currentPlaybackTime > 5) {
    senderURL.searchParams.set(
      "t",
      Math.floor(message.currentPlaybackTime).toString(),
    );
    await browser.tabs.update(tabId, { url: senderURL.href });
  } else {
    await browser.tabs.reload(tabId);
  }
  sendAdWallEvents(youTubeAutoAllowlisted, {
    allowlistDuration,
  });
};

/**
 * Initializes YouTube telemetry
 */
export function start(parameters: StartInfo): void {
  /**
   * The following StartInfo properties are passed into the start function
   * as a temporary solution because core utilities for those objects are missing.
   * Once a core utility for these objects are created, it is expected that they would
   * no longer need to be passed in but imported.
   */
  const { sendAdWallEvents = noop } = parameters;

  // Capture the start date for the YT auto allowlist logic
  const captureDateOnUpdatedWithParameters = captureDateOnUpdate.bind(
    null,
    parameters,
  );
  browser.runtime.onInstalled.addListener(captureDateOnUpdatedWithParameters);

  // In case there are any errors in the main context, we want to capture and
  // check if they are related to our snippets.
  browser.webRequest.onCompleted.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { url, tabId } = details;
      const parsedUrl = new URL(url);
      const errorMsg = parsedUrl.searchParams.get("msg");
      const ytClientVersion = parsedUrl.searchParams.get("client.version");
      const stack = parsedUrl.searchParams.get("stack");
      const type = parsedUrl.searchParams.get("type");

      const [isAllowlisted, isPremium] = await Promise.all([
        hasAllowlistedFilter(tabId),
        parameters.isPremiumActive(),
      ]);

      if (
        errorMsg?.includes("read-only") &&
        errorMsg?.includes("non-configurable")
      ) {
        sendAdWallEvents(contextTamperingEvent, {
          applicationVersion: ytClientVersion,
          isAllowListed: isAllowlisted ? "1" : "0",
          p: isPremium,
        });
      } else {
        sendAdWallEvents(errorEvent, {
          isAllowListed: isAllowlisted ? "1" : "0",
          p: isPremium,
          error: type,
          applicationVersion: ytClientVersion,
          category: ErrorType.UNCAUGHT_EXCEPTION,
          error_msg: stack,
        });
      }
    },
    { urls: ["*://*.youtube.com/error_204*"] },
  );

  browser.webRequest.onCompleted.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { url, tabId } = details;
      const parsedUrl = new URL(url);
      const isFinalEvent = parsedUrl.searchParams.get("final");
      const totalAdTime = parsedUrl.searchParams.get("len");
      const adShownTime = parsedUrl.searchParams.get("rt");
      const adFormat = parsedUrl.searchParams.get("adformat");
      const contentVideo = parsedUrl.searchParams.get("content_v");

      const [isAllowlisted, isPremium] = await Promise.all([
        hasAllowlistedFilter(tabId),
        parameters.isPremiumActive(),
      ]);

      if (
        isFinalEvent !== "1" ||
        !totalAdTime ||
        !adShownTime ||
        !contentVideo
      ) {
        return;
      }

      sendAdWallEvents(adShownEvent, {
        isAllowListed: isAllowlisted ? "1" : "0",
        p: isPremium,
        category: adFormat,
        bc: Math.floor(Number(totalAdTime) * 1000),
        amount: Math.floor(Number(adShownTime) * 1000),
      });
    },
    { urls: ["*://*.youtube.com/api/stats/watchtime?*el=adunit*"] },
  );

  browser.webRequest.onCompleted.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { url, tabId } = details;
      const parsedUrl = new URL(url);
      const error = parsedUrl.searchParams.get("error");
      const clientVersion = parsedUrl.searchParams.get("cver");

      if (!error) {
        return;
      }

      const [isAllowlisted, isPremium] = await Promise.all([
        hasAllowlistedFilter(tabId),
        parameters.isPremiumActive(),
      ]);

      sendAdWallEvents(errorEvent, {
        isAllowListed: isAllowlisted ? "1" : "0",
        p: isPremium,
        error,
        applicationVersion: clientVersion,
        category: ErrorType.SWW_ERROR,
        error_msg: "",
      });
    },
    { urls: ["*://*.youtube.com/api/stats/qoe?*"] },
  );

  const processYouTubeWallMessageWithParameters =
    processYouTubeWallMessage.bind(null, parameters);
  parameters.port.on(
    youTubeWallDetected,
    processYouTubeWallMessageWithParameters,
  );
  parameters.port.on(
    youTubeNavigation,
    async (message: AdWallMessage, sender: MessageSender): Promise<void> => {
      sendAdWallEvents(youTubeNavigation, {
        userLoggedIn: message.userLoggedIn ? "1" : "0",
      });
    },
  );

  parameters.port.on(
    ytRecordEvent,
    async (
      { eventName, eventPayload }: YTRecordEventMessage,
      sender: MessageSender,
    ): Promise<void> => {
      const tabId = sender.tab?.id;
      const [isAllowlisted, isPremium] = await Promise.all([
        hasAllowlistedFilter(tabId),
        parameters.isPremiumActive(),
      ]);

      sendAdWallEvents(eventName, {
        ...eventPayload,
        isAllowListed: isAllowlisted ? "1" : "0",
        p: isPremium,
      });
    },
  );

  const trustedEventNames = [
    youTubeWallDetected,
    youTubeNavigation,
    ytRecordEvent,
  ];
  parameters.addTrustedMessageTypes("https://youtube.com", trustedEventNames);
  parameters.addTrustedMessageTypes(
    "https://www.youtube.com",
    trustedEventNames,
  );
  parameters.addTrustedMessageTypes(
    "https://youtube-nocookie.com",
    trustedEventNames,
  );
  parameters.addTrustedMessageTypes(
    "https://www.youtube-nocookie.com",
    trustedEventNames,
  );
}
