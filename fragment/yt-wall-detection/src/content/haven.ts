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
import { matchingElementFoundKey } from "../shared/index.js";
import { isInHavenExperiment } from "./shared.js";

/**
 * CSS selector identifying YouTube player element
 */
const ytPlayerSelector = "ytd-player";

/**
 * Extend the window object to store a global variable used
 * for understanding if we should keep pausing the videos
 */
declare global {
  interface Window {
    shouldPauseVideos?: boolean;
  }
}

/**
 * Checks if a video is from the YT player
 *
 * @param video The video to be checked
 */
const isVideoFromYoutubePlayer = (video: HTMLElement): boolean => {
  return Boolean(video && video.classList.contains("html5-main-video"));
};

/**
 * Observes the DOM for changes by adding new videos
 */
const observeVideos = (): void => {
  const observer = new MutationObserver((mutations) => {
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

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
};

/**
 * Pause a video and add a lister to pause it when it's state changes
 *
 * @param video The video to pause
 */
const pauseVideo = (video: HTMLVideoElement): void => {
  if (!isVideoFromYoutubePlayer(video)) {
    return;
  }

  if (!video.paused) {
    video.pause();
  }

  const playListener = (): void => {
    if (!window.shouldPauseVideos) {
      video.removeEventListener("play", playListener);
      return;
    }

    video.pause();
  };

  // Prevent play attempts
  video.addEventListener("play", playListener);
};

/**
 * Pauses all YT videos
 */
const pauseAllVideos = (): void => {
  const videos = document.querySelectorAll("video");
  videos.forEach(pauseVideo);

  observeVideos();
};

/**
 * Adds the YT Haven experiments
 */
const addExperiments = async (): Promise<void> => {
  const targetElement = document.querySelector<HTMLElement>(ytPlayerSelector);
  if (!targetElement) {
    return;
  }

  // TODO: Insert experiments
  await Promise.all([]);
};

/**
 * Removes the YT Haven experiments
 */
const removeExperiments = (): void => {
  // TODO: remove experiments
};

/**
 * Starts the YT Haven experiments
 */
export async function start(): Promise<void> {
  // Do nothing if the user is not on the watch video page
  if (!window.location.href.includes("watch")) {
    return;
  }

  const matchingElementFound = await browser.storage.local.get(
    matchingElementFoundKey,
  );

  // Do nothing if the user is not in experiment or if the page was not allowlisted
  if (
    !(await isInHavenExperiment()) ||
    typeof matchingElementFound[matchingElementFoundKey] === "undefined"
  ) {
    return;
  }

  window.shouldPauseVideos = true;
  pauseAllVideos();
  await addExperiments();

  // Add experiments when the watch page is updated
  window.addEventListener("yt-player-updated", (): void => {
    if (window.location.href.includes("watch")) {
      removeExperiments();
      void addExperiments();
    }
  });

  // Remove experiments when the user navigates outside the watch page
  window.addEventListener("yt-navigate-finish", () => {
    if (!window.location.href.includes("watch")) {
      removeExperiments();
    }
  });
}
