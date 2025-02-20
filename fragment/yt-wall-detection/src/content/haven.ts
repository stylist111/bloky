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
const YTPlayerSelector = "video";

const isVideoFromYoutubePlayer = (video: HTMLElement): boolean => {
  return Boolean(video && video.classList.contains("html5-main-video"));
};

// Observe for new video elements
const observeVideos = (): void => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.tagName === "VIDEO") {
            muteAndPauseVideo(node as HTMLVideoElement);
          }
        }
      });
    });
  });

  // Start observing the DOM
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
};

// pause and mute all videos
const muteAndPauseVideo = (video: HTMLVideoElement): void => {
  if (!isVideoFromYoutubePlayer(video)) {
    return;
  }

  // Mute the video
  video.muted = true;

  if (!video.paused) {
    video.pause();
  }

  // Ensure it stays muted
  video.addEventListener("volumechange", () => {
    if (!video.muted) {
      video.muted = true;
    }
  });

  // Prevent play attempts
  video.addEventListener("play", () => {
    video.pause();
  });
};

// Handle existing videos
const handleExistingVideos = (): void => {
  const videos = document.querySelectorAll(YTPlayerSelector);
  videos.forEach(muteAndPauseVideo);
};

const addExperimentOnTopOfVideo = async (
  targetElement: HTMLElement,
): Promise<void> => {
  // Add experiment variants here.
};

const handlePlayer = (): void => {
  const currentPlayer = document.querySelector<HTMLElement>(YTPlayerSelector);
  if (!currentPlayer) {
    window.addEventListener("yt-player-updated", (event) => {
      const currentPlayer = document.querySelector<HTMLElement>("ytd-player");
      if (!currentPlayer) {
        return;
      }

      void addExperimentOnTopOfVideo(currentPlayer);
      handleExistingVideos();
      observeVideos();
    });
    return;
  }

  void addExperimentOnTopOfVideo(currentPlayer);
  handleExistingVideos();
};

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

  handlePlayer();
}
