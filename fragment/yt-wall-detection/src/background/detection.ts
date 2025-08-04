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
import { type Filter } from "@eyeo/webext-ad-filtering-solution";

import {
  type MessageSender,
  type AdWallMessage,
  type YTHavenPlayerErrorMessage,
  type YTHavenToggleMessage,
  type YTHavenRecordEvent,
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
  ytHavenModalFlag,
  ytHavenOverlayFlag,
  matchingElementFoundKey,
  ytHavenWatchCTAClicked,
  ytHavenEmbeddedPlayerIssue,
  ytHavenMetaTagFound,
  ytHavenNextVideoNotFound,
  ytHavenNonEmbeddableFound,
  ytHavenNeverShowOverlayClick,
  ytHavenLabelWatchingDisable,
  ytHavenLabelWatchingIgnore,
  ytHavenNonPlayableFound,
  ytHavenModalClosed,
  ytHavenOverlayShown,
  ytHavenToggleState,
  ytHavenDefaultEnabledFlag,
  ytHavenToggleStateUpdate,
  ytHavenToggleStatePrefsKey,
  ytHavenShouldStart,
  ytHavenEmbedFreeFlag,
  ytHavenEmbedPremiumFlag,
  ytHavenToggleStateEnabled,
  ytHavenToggleStateDisabled,
  ytHavenRecordEvent,
  ytHavenConflict,
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

  const filters = await ewe.filters.getAllowingFilters(tabId);
  const isAllowListed = !!filters.length;
  if (isAllowListed) {
    sendAdWallEvents(youTubeAlreadyAllowListed, {
      userLoggedIn: message.userLoggedIn ? "1" : "0",
      isAllowListed: "1",
    });
    return;
  }
  sendAdWallEvents(youTubeWallDetected, {
    userLoggedIn: message.userLoggedIn ? "1" : "0",
    isAllowListed: "0",
  });

  const senderURL = new URL(tabURL);
  const host = senderURL.hostname.replace(/^www\./, "");
  const ruleText = `@@||${host}^$document`;
  const metadata = {
    expiresByTabId: tabId,
    origin: "yt-auto",
    created: Date.now(),
  };
  await ewe.filters.add(ruleText, metadata);

  // Store the allowlist in the local storage so that we know it on the second run
  await browser.storage.local.set({
    [matchingElementFoundKey]: true,
  });

  if (message.currentPlaybackTime > 5) {
    senderURL.searchParams.set(
      "t",
      Math.floor(message.currentPlaybackTime).toString(),
    );
    senderURL.searchParams.delete("ab_channel");
    await browser.tabs.update(tabId, { url: senderURL.href });
  } else {
    await browser.tabs.reload(tabId);
  }
  sendAdWallEvents(youTubeAutoAllowlisted);
};

/**
 * Executes a script in the current tab to attempt detecting
 * other ad blockers that might interfere with the solution.
 *
 * @param tabId The tab id.
 */
async function executeScript(tabId: number): Promise<boolean> {
  if (typeof tabId === "undefined") {
    return false;
  }

  const world = "MAIN";
  const func = (): boolean => {
    return XMLHttpRequest.toString().includes("uboLog");
  };

  if (browser.scripting?.executeScript) {
    try {
      const out = await browser.scripting.executeScript({
        target: { tabId },
        func,
        world,
      });
      return out[0].result as boolean;
    } catch (e) {
      return false;
    }
  }

  return false;
}

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

  // Remove the allowlisting state from storage when the filter is removed
  ewe.filters.onRemoved.addListener(async (filter: Filter) => {
    if (
      filter.text.endsWith("youtube.com^$document") &&
      filter.type === "allowing"
    ) {
      await browser.storage.local.remove(matchingElementFoundKey);
    }
  });

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

      const tabId = sender.tab?.id;
      const result = await executeScript(tabId);

      if (result) {
        sendAdWallEvents(ytHavenConflict);
      }
    },
  );

  parameters.port.on(ytHavenWatchCTAClicked, (): void => {
    sendAdWallEvents(ytHavenWatchCTAClicked);
  });

  parameters.port.on(ytHavenNeverShowOverlayClick, async (): Promise<void> => {
    sendAdWallEvents(ytHavenNeverShowOverlayClick);

    // Disable the experiment flags to not show the overlay in content script again
    await ewe.experiments.overrideFlag(ytHavenOverlayFlag, false);
    await ewe.experiments.overrideFlag(ytHavenModalFlag, false);
  });

  parameters.port.on(
    ytHavenNonEmbeddableFound,
    (message: YTHavenPlayerErrorMessage): void => {
      sendAdWallEvents(ytHavenNonEmbeddableFound, {
        errorCode: message.errorCode,
      });
    },
  );

  parameters.port.on(
    ytHavenNonPlayableFound,
    (message: YTHavenPlayerErrorMessage): void => {
      sendAdWallEvents(ytHavenNonPlayableFound, {
        errorCode: message.errorCode,
      });
    },
  );

  parameters.port.on(ytHavenNextVideoNotFound, (): void => {
    sendAdWallEvents(ytHavenNextVideoNotFound);
  });

  parameters.port.on(ytHavenMetaTagFound, (): void => {
    sendAdWallEvents(ytHavenMetaTagFound);
  });

  parameters.port.on(
    ytHavenEmbeddedPlayerIssue,
    (message: YTHavenPlayerErrorMessage): void => {
      sendAdWallEvents(ytHavenEmbeddedPlayerIssue, {
        errorCode: message.errorCode,
      });
    },
  );

  parameters.port.on(
    ytHavenLabelWatchingDisable,
    async (message: any, sender: MessageSender): Promise<void> => {
      const tabId = sender?.tab?.id;

      if (!tabId) {
        return;
      }

      sendAdWallEvents(ytHavenLabelWatchingDisable);

      // Disable the experiment flags to not show the overlay/embed in content script again
      await ewe.experiments.overrideFlag(ytHavenOverlayFlag, false);
      // await ewe.experiments.overrideFlag(ytHavenIframeFlag, false);

      // Reload the tab so that the experiment is removed from content script
      await browser.tabs.reload(tabId);
    },
  );

  parameters.port.on(ytHavenLabelWatchingIgnore, (): void => {
    sendAdWallEvents(ytHavenLabelWatchingIgnore);
  });

  parameters.port.on(ytHavenModalClosed, (): void => {
    sendAdWallEvents(ytHavenModalClosed);
  });

  parameters.port.on(ytHavenOverlayShown, (): void => {
    sendAdWallEvents(ytHavenOverlayShown);
  });

  parameters.port.on(
    ytHavenRecordEvent,
    async ({
      type,
      eventName,
      ...eventPayload
    }: YTHavenRecordEvent): Promise<void> => {
      const isPremium = await parameters.isPremiumActive();
      sendAdWallEvents(eventName, {
        ...eventPayload,
        // pass the premium flag to differentiate between users from experiments
        p: isPremium,
      });
    },
  );

  // check if the user is in the YT Haven experiment
  parameters.port.on(ytHavenShouldStart, async (): Promise<boolean> => {
    const isPremium = await parameters.isPremiumActive();
    const ytHavenFlags = await Promise.all([
      ewe.experiments.getFlag(ytHavenEmbedFreeFlag),
      ewe.experiments.getFlag(ytHavenEmbedPremiumFlag),
    ]);
    return (
      (Boolean(ytHavenFlags[0]) && !isPremium) ||
      (Boolean(ytHavenFlags[1]) && isPremium)
    );
  });

  // Get the toggle state from persistent storage, as default if user is premium
  // it should be false otherwise depends on the variant configuration
  parameters.port.on(ytHavenToggleState, async (): Promise<boolean> => {
    const isPremium = await parameters.isPremiumActive();
    const [currentState, isDefaultEnabled] = await Promise.all([
      browser.storage.local.get(ytHavenToggleStatePrefsKey),
      ewe.experiments.getFlag(ytHavenDefaultEnabledFlag),
    ]);
    return Boolean(
      currentState[ytHavenToggleStatePrefsKey] ??
        (isPremium ? false : isDefaultEnabled),
    );
  });

  // Update the toggle state
  parameters.port.on(
    ytHavenToggleStateUpdate,
    async ({ newState }: YTHavenToggleMessage): Promise<boolean> => {
      // update the state
      await browser.storage.local.set({
        [ytHavenToggleStatePrefsKey]: newState,
      });

      // record toggle state change event
      const isPremium = await parameters.isPremiumActive();
      const eventName = newState
        ? ytHavenToggleStateEnabled
        : ytHavenToggleStateDisabled;
      const eventPayload = { p: isPremium };
      sendAdWallEvents(eventName, eventPayload);

      return newState;
    },
  );

  const trustedEventNames = [
    youTubeWallDetected,
    youTubeNavigation,
    ytHavenShouldStart,
    ytHavenWatchCTAClicked,
    ytHavenNeverShowOverlayClick,
    ytHavenNonEmbeddableFound,
    ytHavenNonPlayableFound,
    ytHavenEmbeddedPlayerIssue,
    ytHavenMetaTagFound,
    ytHavenNextVideoNotFound,
    ytHavenLabelWatchingDisable,
    ytHavenLabelWatchingIgnore,
    ytHavenModalClosed,
    ytHavenOverlayShown,
    ytHavenToggleState,
    ytHavenToggleStateUpdate,
    ytHavenRecordEvent,
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
