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
import * as browser from "webextension-polyfill";
import { type YTEventData } from "./shared.types.js";
import {
  ytHavenNextVideoNotFound,
  ytHavenNonEmbeddableFound,
} from "../shared/index.js";
import { unpauseCurrentVideo } from "./pause-video.js";

/**
 * Removes the embedded player from the DOM
 */
const removeEmbedPlayer = (): void => {
  const embedPlayer = document.getElementById("embed-player");
  embedPlayer?.parentNode?.removeChild(embedPlayer);
};

/**
 * Checks if the parameter is YTEventData
 * @param obj The object to be checked
 */
function instanceOfYouTubeEventData(obj: any): obj is YTEventData {
  return (
    obj &&
    obj instanceof Object &&
    "info" in obj &&
    obj.info instanceof Object &&
    "progressState" in obj.info
  );
}

/**
 * Attempts to load the next video when the current video in the embedded player has ended
 */
async function handleEmbeddedVideoEnding(): Promise<void> {
  if (window.videoLoading) {
    return;
  }
  const nextVideoAncher = document.querySelector(
    "#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-left-controls > a.ytp-next-button.ytp-button",
  );
  if (
    nextVideoAncher &&
    nextVideoAncher instanceof HTMLAnchorElement &&
    nextVideoAncher.href &&
    !window.videoLoading
  ) {
    nextVideoAncher.click();
    window.videoLoading = true;
    return;
  }
  const queryString = new URLSearchParams(window.location.search);
  const videoId = queryString.get("v");
  if (
    window.currentVideoId === videoId &&
    window.nextVideoId &&
    !window.videoLoading
  ) {
    queryString.set("v", window.nextVideoId);
    window.location.search = queryString.toString();
    window.videoLoading = true;
    return;
  }
  removeEmbedPlayer();
  unpauseCurrentVideo();
  void browser.runtime.sendMessage({
    type: ytHavenNextVideoNotFound,
  });
}

/**
 * Process messages from the embedded YT iFrame
 * @param {MessageEvent} event The event message from the embedded player
 */
const iFrameMessageListener = (event: MessageEvent): void => {
  const iFramePlayer = document.getElementById("embed-player");
  if (
    iFramePlayer &&
    iFramePlayer instanceof HTMLIFrameElement &&
    event.source === iFramePlayer.contentWindow &&
    event instanceof Object &&
    "data" in event &&
    typeof event.data === "string"
  ) {
    const eventData: YTEventData = JSON.parse(event.data);
    const queryString = new URLSearchParams(window.location.search);
    const videoId = queryString.get("v");
    if (
      eventData?.info?.videoData?.video_id === videoId &&
      eventData?.event === "initialDelivery"
    ) {
      window.videoLoading = false;
      return;
    }
    if (!instanceOfYouTubeEventData(eventData)) {
      return;
    }
    const currentTimeInt = Math.ceil(eventData?.info?.progressState?.current);
    const durationInt = Math.ceil(eventData?.info?.progressState?.duration);
    if (currentTimeInt === durationInt && durationInt > 0) {
      void handleEmbeddedVideoEnding();
    }
  }
};

/**
 * Add the YT embedded iframe element with video id obtained from the current URL
 * @param targetElement An existing DOM element which to overlay the iframe which will contain the embedded player
 */
export async function addEmbedVideoOnTop(
  targetElement: HTMLElement,
): Promise<void> {
  const queryString = new URLSearchParams(window.location.search);
  const videoId = queryString.get("v");
  const listId = queryString.get("list");
  if (!videoId) {
    return;
  }
  const iFramePlayerElement = document.getElementById("embed-player");
  if (!(iFramePlayerElement instanceof HTMLIFrameElement)) {
    removeEmbedPlayer();
  }
  if (iFramePlayerElement && iFramePlayerElement instanceof HTMLIFrameElement) {
    // This message is being sent to the YT JS code in the embedded iframe.
    // It is a bit of hack
    // This is a link to the similar function the YT Frame API
    // https://developers.google.com/youtube/iframe_api_reference#loadVideoById
    iFramePlayerElement.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: "loadVideoById",
        args: [videoId],
      }),
      "*",
    );
    window.videoLoading = true;
    return;
  }
  let iFrameSrc = `https://www.youtube-nocookie.com/embed/${videoId}?controls=1&autoplay=1&enablejsapi=1`;
  // If the current URL indicates a YT playlist, then use a different query string for the iframe src
  if (listId) {
    iFrameSrc = `https://www.youtube-nocookie.com/embed/${videoId}?listType=playlist&list=${listId}&controls=1&autoplay=1&enablejsapi=1`;
  }

  const iFramePlayer = document.createElement("iframe");
  iFramePlayer.onload = function () {
    setTimeout(() => {
      iFramePlayer.contentWindow?.postMessage('{"event":"listening"}', "*");
    });
  };
  window.addEventListener("message", iFrameMessageListener);
  iFramePlayer.id = "embed-player";
  iFramePlayer.src = iFrameSrc;
  iFramePlayer.style.position = "absolute";
  iFramePlayer.style.top = "0";
  iFramePlayer.style.left = "0";
  iFramePlayer.style.width = "100%";
  iFramePlayer.style.height = "100%";
  iFramePlayer.style.border = "0";
  iFramePlayer.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iFramePlayer.allowFullscreen = true;
  iFramePlayer.referrerPolicy = "strict-origin-when-cross-origin";
  targetElement.style.position = "relative";
  targetElement.style.overflow = "hidden";
  targetElement.appendChild(iFramePlayer);
}

/**
 * Initializes YouTube embedded video player
 */
export async function start(targetElement: HTMLElement): Promise<void> {
  // check if video can be played in an embedded player
  const queryString = new URLSearchParams(window.location.search);
  const videoId = queryString.get("v");
  if (window.currentVideoId === videoId && window.playableInEmbed === false) {
    unpauseCurrentVideo();
    void browser.runtime.sendMessage({
      type: ytHavenNonEmbeddableFound,
    });
    return;
  }
  void addEmbedVideoOnTop(targetElement);
}

/**
 * Capture and save either of the following data that might be used later
 * - if a video was just loaded, get its playabilityStatus in an embedded player
 * - if a video was just loaded, get the next video to play once this video is complete
 */
window.addEventListener("yt-navigate-finish", (event: CustomEvent) => {
  // General clean up when the user is not on the watch video page
  if (!window.location.href.includes("watch")) {
    window.currentVideoId = undefined;
    window.playableInEmbed = undefined;
    window.nextVideoId = undefined;
    window.videoLoading = undefined;
    removeEmbedPlayer();
    return;
  }
  const queryString = new URLSearchParams(window.location.search);
  const currentVideoId = queryString.get("v");
  if (currentVideoId) {
    window.currentVideoId = currentVideoId;
    window.videoLoading = false;
  } else {
    return;
  }

  if (
    event?.detail?.response?.playerResponse?.playabilityStatus &&
    event?.detail?.response?.playerResponse?.videoDetails?.videoId &&
    window.currentVideoId ===
      event?.detail?.response?.playerResponse?.videoDetails?.videoId
  ) {
    // save playable in Embed indicator
    window.playableInEmbed =
      event?.detail?.response?.playerResponse?.playabilityStatus?.playableInEmbed;
  }
  if (
    window.currentVideoId ===
      event?.detail?.response?.playerResponse?.videoDetails?.videoId &&
    event?.detail?.response?.response?.contents?.twoColumnWatchNextResults
      ?.autoplay?.autoplay?.sets[0]?.autoplayVideo?.watchEndpoint?.videoId
  ) {
    window.nextVideoId =
      event?.detail?.response?.response?.contents?.twoColumnWatchNextResults?.autoplay?.autoplay?.sets[0]?.autoplayVideo?.watchEndpoint?.videoId;
  }
});
