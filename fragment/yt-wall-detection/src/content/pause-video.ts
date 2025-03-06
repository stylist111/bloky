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

import { isWatchPage } from "./shared.js";

/**
 * Mutation observer for videos
 */
let pauseObserver: MutationObserver | null = null;

/**
 * The last video that was attempted to be played.
 * We store this in case we need to recover the play state.
 */
let lastPausedVideo: HTMLVideoElement | null = null;

/**
 * Observes the DOM for changes by adding new videos
 */
const observeVideos = (): void => {
  pauseObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.tagName === "VIDEO") {
            pauseVideo(node as HTMLVideoElement);
          }
        }
      });
    });
  });

  pauseObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
};

/**
 * Event listener that pauses the video and
 * stores the last attempted to play video
 *
 * @param event The play event
 */
const playListener = (event: Event): void => {
  if (event.target instanceof HTMLVideoElement && isWatchPage()) {
    lastPausedVideo = event.target;
    lastPausedVideo.pause();
  }
};

/**
 * Pause a video and add a lister to pause it when it's state changes
 *
 * @param video The video to pause
 */
const pauseVideo = (video: HTMLVideoElement): void => {
  // Pause videos only from watch page
  if (!video.paused && isWatchPage()) {
    video.pause();
  }

  // Prevent play attempts
  video.addEventListener("play", playListener);
};

/**
 * Start pausing videos when user navigates on the watch page
 */
export const startPause = (): void => {
  const videos = document.querySelectorAll("video");
  videos.forEach(pauseVideo);

  observeVideos();
};

/**
 * Stops pausing videos and remove the mutation observer
 */
export const stopPause = (): void => {
  pauseObserver?.disconnect();
  pauseObserver = null;
  resumeCurrentVideo();
};

/**
 * Resume the last paused video on the page.
 * This is in case we don't need to fully stop the pausing logic but
 * only to resume playing the current video
 */
export const resumeCurrentVideo = (): void => {
  const videos = document.querySelectorAll("video");

  // Cleanup stop-play listeners from all videos on the page in order
  // to allow the last paused video to play
  videos.forEach((video) => {
    video.removeEventListener("play", playListener);
  });

  void lastPausedVideo?.play();
};
