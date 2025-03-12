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
import browser from "webextension-polyfill";
import {
  matchingElementFoundKey,
  ytHavenEmbeddedPlayerIssue,
  ytHavenMetaTagFound,
  ytHavenNonEmbeddableFound,
  ytHavenNonPlayableFound,
} from "../shared/index.js";
import {
  getIframePlayer,
  isInHavenExperiment,
  isWatchPage,
  videoContextStore,
} from "./shared.js";
import {
  removeEmbedPlayer,
  start as startEmbedExperiment,
} from "./embed-haven.js";
import { insertOverlayExp, removeVideoOverlay } from "./overlay.js";
import {
  startPause,
  resumeCurrentVideo,
  pauseCurrentVideos,
} from "./pause-video.js";
import type { YTEventData } from "./shared.types";

/**
 * CSS selector identifying YouTube player element
 */
const ytPlayerSelector = "ytd-player";

/**
 * The playability status of the video
 */
enum PlayabilityStatus {
  OK = "OK",
  // UNPLAYABLE = "UNPLAYABLE", // members only (without access)
  // LOGIN_REQUIRED = "LOGIN_REQUIRED", // private video
  // ERROR = "ERROR", // video not found (maybe private)
}

/**
 * Adds the YT Haven experiments
 */
const addExperiments = async (): Promise<void> => {
  const targetElement = document.querySelector<HTMLElement>(ytPlayerSelector);
  if (!targetElement) {
    return;
  }

  await Promise.all([
    insertOverlayExp(targetElement),
    startEmbedExperiment(targetElement),
  ]);
};

/**
 * Removes the YT Haven experiments
 */
const removeExperiments = (): void => {
  removeVideoOverlay();
  removeEmbedPlayer();
};

/**
 * Listens on the navigation event. Updates the video context.
 * Adds or removes the experiments
 *
 * @param event The navigation event
 */
const navigationListener = async (event: CustomEvent): Promise<void> => {
  const videoId = event?.detail?.endpoint?.watchEndpoint?.videoId;

  if (!isWatchPage() || !(await shouldStartExperiment()) || !videoId) {
    removeExperiments();
    return;
  }

  pauseCurrentVideos();
  const playlistId = event?.detail?.endpoint?.watchEndpoint?.playlistId;
  const isEmbeddable =
    event?.detail?.response?.playerResponse?.playabilityStatus?.playableInEmbed;
  const playabilityStatus =
    event?.detail?.response?.playerResponse?.playabilityStatus?.status;

  // Unpause the current Video if is not embeddable
  // or if it's unplayable (e.g. members only without access)
  if (!isEmbeddable || playabilityStatus !== PlayabilityStatus.OK) {
    resumeCurrentVideo();
    removeExperiments();
    void browser.runtime.sendMessage({
      type: !isEmbeddable ? ytHavenNonEmbeddableFound : ytHavenNonPlayableFound,
      errorCode: playabilityStatus,
    });
    return;
  }

  const nextVideoId =
    event?.detail?.response?.response?.contents?.twoColumnWatchNextResults
      ?.autoplay?.autoplay?.sets[0]?.autoplayVideo?.watchEndpoint?.videoId;
  // The current time of the video e.g ?t=100
  const startSeconds =
    event?.detail?.response?.endpoint?.watchEndpoint?.startTimeSeconds;

  // update the video context, as this will be used in other parts of the fragment
  videoContextStore.setVideoContext({
    playlistId,
    isEmbeddable,
    videoId,
    nextVideoId,
    startSeconds,
  });

  await addExperiments();
};

/**
 * check if the YT Haven DOM element exists, if not - creates and adds it
 */
const havenElementExits = (): boolean => {
  let metaTag = document.getElementById("yt-haven");
  if (metaTag) {
    return true;
  }

  metaTag = document.createElement("meta");
  metaTag.id = "yt-haven";
  (document.head || document.documentElement).prepend(metaTag);
  return false;
};

/**
 * Listens for any error on embedding the video inside the iFrame.
 *
 * @param event The message event sent by the iframe player
 */
const iFrameErrorListener = (event: MessageEvent): void => {
  const playerElem = getIframePlayer();

  if (
    playerElem &&
    playerElem instanceof HTMLIFrameElement &&
    event.source === playerElem.contentWindow &&
    "data" in event &&
    typeof event.data === "string"
  ) {
    const eventData: YTEventData = JSON.parse(event.data);
    const errorCode = eventData?.info?.videoData?.errorCode;

    // Detect private videos/playlists or bot detection
    if (eventData?.event === "initialDelivery" && errorCode) {
      void browser.runtime.sendMessage({
        type: ytHavenEmbeddedPlayerIssue,
        errorCode,
      });
    }
  }
};

/**
 * Only start the experiment if the page was allowlisted and the user is in
 * the haven experiment
 */
const shouldStartExperiment = async (): Promise<boolean> => {
  const matchingElementFound = await browser.storage.local.get(
    matchingElementFoundKey,
  );

  return (
    (await isInHavenExperiment()) &&
    typeof matchingElementFound[matchingElementFoundKey] !== "undefined"
  );
};

/**
 * Starts the YT Haven experiments
 */
export async function start(): Promise<void> {
  if (!(await shouldStartExperiment())) {
    return;
  }

  if (havenElementExits()) {
    void browser.runtime.sendMessage({
      type: ytHavenMetaTagFound,
    });
    return;
  }

  startPause();

  window.addEventListener("yt-navigate-finish", (event: CustomEvent) => {
    void navigationListener(event);
  });

  // Listens for any errors in the iframe player
  window.addEventListener("message", (event: MessageEvent): void => {
    iFrameErrorListener(event);
  });
}
