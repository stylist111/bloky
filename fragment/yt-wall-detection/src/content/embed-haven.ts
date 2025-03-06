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
import type { YTEventData } from "./shared.types.js";
import {
  ytHavenIframeFlag,
  ytHavenNextVideoNotFound,
} from "../shared/index.js";
import { resumeCurrentVideo } from "./pause-video.js";
import {
  createIframePlayer,
  getExperimentFlag,
  getIframePlayer,
  videoContextStore,
} from "./shared.js";

/**
 * Enum with the player state
 * Docs: https://developers.google.com/youtube/iframe_api_reference#onStateChange
 */
enum PlayerState {
  ENDED = 0,
}

/**
 * Removes the embedded player from the DOM
 */
export const removeEmbedPlayer = (): void => {
  const playerElem = getIframePlayer();
  playerElem?.parentNode?.removeChild(playerElem);
};

/**
 * Attempts to load the next video when the current video in the embedded player has ended
 */
async function handleEmbeddedVideoEnding(): Promise<void> {
  const nextVideoAnchor = document.querySelector(
    "#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-left-controls > a.ytp-next-button.ytp-button",
  );

  if (
    nextVideoAnchor &&
    nextVideoAnchor instanceof HTMLAnchorElement &&
    nextVideoAnchor.href
  ) {
    nextVideoAnchor.click();
    return;
  }

  const { nextVideoId } = videoContextStore.getVideoContext();
  const searchParams = new URLSearchParams(window.location.search);

  if (nextVideoId) {
    searchParams.set("v", nextVideoId);
    window.location.search = searchParams.toString();
    return;
  }

  removeEmbedPlayer();
  resumeCurrentVideo();
  void browser.runtime.sendMessage({
    type: ytHavenNextVideoNotFound,
  });
}

/**
 * Process messages from the embedded YT iFrame
 * @param {MessageEvent} event The event message from the embedded player
 */
const iFrameMessageListener = (event: MessageEvent): void => {
  const playerElem = getIframePlayer();

  if (
    playerElem &&
    playerElem instanceof HTMLIFrameElement &&
    event.source === playerElem.contentWindow &&
    "data" in event &&
    typeof event.data === "string"
  ) {
    const eventData: YTEventData = JSON.parse(event.data);
    const playerState = eventData?.info?.playerState;

    if (playerState === PlayerState.ENDED) {
      void handleEmbeddedVideoEnding();
    }
  }
};

/**
 * Add the YT embedded iframe element with video id obtained from the current URL
 *
 * @param targetElement An existing DOM element which to overlay the iframe which will contain the embedded player
 */
export async function addEmbedVideoOnTop(
  targetElement: HTMLElement,
): Promise<void> {
  const { videoId, playlistId, startSeconds } =
    videoContextStore.getVideoContext();

  let playerElem = getIframePlayer();
  if (!(playerElem instanceof HTMLIFrameElement)) {
    removeEmbedPlayer();
  }

  if (playerElem && playerElem instanceof HTMLIFrameElement) {
    // This message is being sent to the YT JS code in the embedded iframe.
    // It is a bit of hack
    // This is a link to the similar function the YT Frame API
    // https://developers.google.com/youtube/iframe_api_reference#loadVideoById
    playerElem.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: "loadVideoById",
        args: [videoId, startSeconds],
      }),
      "*",
    );

    return;
  }

  playerElem = createIframePlayer({
    videoId,
    playlistId,
    startSeconds,
    showWatchingWith: true,
  });

  playerElem.onload = function () {
    setTimeout(() => {
      playerElem?.contentWindow?.postMessage('{"event":"listening"}', "*");
    });
  };

  window.addEventListener("message", (event: MessageEvent): void => {
    iFrameMessageListener(event);
  });

  targetElement.style.position = "relative";
  targetElement.style.overflow = "hidden";
  targetElement.appendChild(playerElem);
}

/**
 * Initializes YouTube embedded video player
 */
export async function start(targetElement: HTMLElement): Promise<void> {
  const isIframeEmbedExp = await getExperimentFlag(ytHavenIframeFlag);

  // Do nothing if the user is not in experiment
  if (!isIframeEmbedExp) {
    return;
  }

  void addEmbedVideoOnTop(targetElement);
}
