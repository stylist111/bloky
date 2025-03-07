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

import { type MessageSender, type AdWallMessage } from "@eyeo/polyfills/all";
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
  ytHavenIframeFlag,
  ytHavenModalFlag,
  ytHavenOverlayFlag,
  matchingElementFoundKey,
  ytHavenWatchCTAClicked,
  ytHavenNextVideoNotFound,
  ytHavenNonEmbeddableFound,
  ytHavenNeverShowOverlayClick,
  ytHavenLabelWatchingDisable,
  ytHavenLabelWatchingIgnore,
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
 * Checks if the user is in one of the Haven experiments
 */
const isInHavenExperiment = async (): Promise<boolean> => {
  const expFlags = await Promise.all([
    ewe.experiments.getFlag(ytHavenIframeFlag),
    ewe.experiments.getFlag(ytHavenModalFlag),
    ewe.experiments.getFlag(ytHavenOverlayFlag),
  ]);

  return expFlags.some((flag) => Boolean(flag));
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
  if (await isInHavenExperiment()) {
    await browser.storage.local.set({
      [matchingElementFoundKey]: true,
    });
  }

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
 * Initializes YouTube telemetry
 */
export function start(parameters: StartInfo): void {
  /**
   * The following StartInfo properties are passed into the start function
   * as a temporary solution because core utillities for those objects are missing.
   * Once a core utility for these objects are created, it is expected that they would
   * no longer need to be passed in but imported.
   */
  const { sendAdWallEvents = noop } = parameters;

  const sendEventWithExperiment = async (eventName: string): Promise<void> => {
    const assignments = await ewe.experiments.getAssignments();
    sendAdWallEvents(eventName, {
      experimentVariant: assignments["yt-haven"],
    });
  };

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
  parameters.port.on(youTubeNavigation, (message: AdWallMessage): void => {
    sendAdWallEvents(youTubeNavigation, {
      userLoggedIn: message.userLoggedIn ? "1" : "0",
    });
  });

  parameters.port.on(ytHavenWatchCTAClicked, async (): Promise<void> => {
    await sendEventWithExperiment(ytHavenWatchCTAClicked);
  });

  parameters.port.on(ytHavenNeverShowOverlayClick, async (): Promise<void> => {
    await sendEventWithExperiment(ytHavenNeverShowOverlayClick);

    // Disable the experiment flags to not show the overlay in content script again
    await ewe.experiments.overrideFlag(ytHavenOverlayFlag, false);
    await ewe.experiments.overrideFlag(ytHavenModalFlag, false);
  });

  parameters.port.on(ytHavenNonEmbeddableFound, async (): Promise<void> => {
    await sendEventWithExperiment(ytHavenNonEmbeddableFound);
  });

  parameters.port.on(ytHavenNextVideoNotFound, async (): Promise<void> => {
    await sendEventWithExperiment(ytHavenNextVideoNotFound);
  });

  parameters.port.on(
    ytHavenLabelWatchingDisable,
    async (message: any, sender: MessageSender): Promise<void> => {
      const tabId = sender?.tab?.id;

      if (!tabId) {
        return;
      }

      await sendEventWithExperiment(ytHavenLabelWatchingDisable);

      // Disable the experiment flags to not show the overlay/embed in content script again
      await ewe.experiments.overrideFlag(ytHavenOverlayFlag, false);
      await ewe.experiments.overrideFlag(ytHavenIframeFlag, false);

      // Reload the tab so that the experiment is removed from content script
      await browser.tabs.reload(tabId);
    },
  );

  parameters.port.on(ytHavenLabelWatchingIgnore, async (): Promise<void> => {
    await sendEventWithExperiment(ytHavenLabelWatchingIgnore);
  });

  const trustedEventNames = [
    youTubeWallDetected,
    youTubeNavigation,
    ytHavenWatchCTAClicked,
    ytHavenNeverShowOverlayClick,
    ytHavenNonEmbeddableFound,
    ytHavenNextVideoNotFound,
    ytHavenLabelWatchingDisable,
    ytHavenLabelWatchingIgnore,
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
