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
  ytHavenIframeFlag,
  ytHavenOverlayFlag,
  ytHavenModalFlag,
} from "../shared/index.js";
import type {
  IframePlayerConfig,
  PartialPrivateExperimentsData,
  VideoContext,
  VideoContextStoreType,
} from "./shared.types.js";

/**
 * Storage key for the experiments
 */
const expStorageKey = "ewe:split_experiments";

/**
 * The embedded iframe player ID
 */
const iframePlayerId = "yt-haven-embed-player";

/**
 * Store used for retrieving the current video context
 */
export const videoContextStore: VideoContextStoreType = {
  // Private video context state
  _videoContext: null as VideoContext | null,

  /**
   * Updates the current video context.
   *
   * @param newContext The new VideoContext to set.
   */
  setVideoContext(newContext: VideoContext): void {
    this._videoContext = newContext;
  },

  /**
   * Retrieves the current video context.
   *
   * @returns The current VideoContext.
   * @throws Error if the context is not set
   */
  getVideoContext(): VideoContext {
    if (!this._videoContext) {
      throw new Error("Video store was not initialized properly");
    }

    return this._videoContext;
  },
};

/**
 * Retrieves the experiment flag from local storage
 *
 * @param flagId The the experiment flag
 */
export async function getExperimentFlag(flagId: string): Promise<any> {
  const storedData = await browser.storage.local.get(expStorageKey);
  const experiments = storedData[expStorageKey];

  if (!isPartialPrivateExperimentsData(experiments)) {
    return null;
  }

  if (
    experiments.overrides &&
    typeof experiments.overrides[flagId] !== "undefined"
  ) {
    return experiments.overrides[flagId];
  }

  if (experiments.flags && typeof experiments.flags[flagId] !== "undefined") {
    return experiments.flags[flagId];
  }

  return null;
}

/**
 * Checks if the user is in one of the YT Haven experiments
 */
export async function isInHavenExperiment(): Promise<boolean> {
  const ytHavenFlags = await Promise.all([
    getExperimentFlag(ytHavenIframeFlag),
    getExperimentFlag(ytHavenOverlayFlag),
    getExperimentFlag(ytHavenModalFlag),
  ]);
  return ytHavenFlags.some((result) => Boolean(result));
}

/**
 * Checks if the current path is /watch and domain is not a subdomain of the main domain
 */
export function isWatchPage(): boolean {
  const parsedUrl = new URL(window.location.href);
  const { hostname, pathname } = parsedUrl;

  const rightDomain =
    hostname === "www.youtube.com" || hostname === "youtube.com";
  const rightPath = pathname === "/watch" || pathname.startsWith("/watch/");

  return rightDomain && rightPath;
}

/**
 * Checks whether given candidate represents relevants parts of stored split
 * experiments data
 *
 * @param candidate - Candidate
 *
 * @returns whether given candidate represents relevants parts of stored split
 * experiments data
 */
function isPartialPrivateExperimentsData(
  candidate: unknown,
): candidate is PartialPrivateExperimentsData {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "flags" in candidate &&
    "overrides" in candidate
  );
}

/**
 * Get the iframe player element from the DOM
 */
export function getIframePlayer(): HTMLIFrameElement | null {
  return document.getElementById(iframePlayerId) as HTMLIFrameElement;
}

/**
 * Creates the iframe player.
 *
 * @param playerConfig The player configuration
 * @return The iframe
 */
export function createIframePlayer(
  playerConfig: IframePlayerConfig,
): HTMLIFrameElement {
  const {
    videoId,
    playlistId,
    showWatchingWith,
    startSeconds,
    showInModal = false,
  } = playerConfig;

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);

  // Docs: https://developers.google.com/youtube/player_parameters
  embedUrl.searchParams.set("controls", "1");
  embedUrl.searchParams.set("autoplay", "1");
  embedUrl.searchParams.set("enablejsapi", "1");

  if (startSeconds) {
    embedUrl.searchParams.set("start", startSeconds.toString());
  }

  if (playlistId) {
    embedUrl.searchParams.set("listType", "playlist");
    embedUrl.searchParams.set("list", playlistId);
  }

  // Adds the indicator on the video
  if (showWatchingWith) {
    embedUrl.hash = "yt-haven";
  }

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl.toString();
  iframe.id = iframePlayerId;
  iframe.style.border = "0";
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";

  if (showInModal) {
    iframe.style.width = "50%";
    iframe.style.aspectRatio = "16/9";
    iframe.style.borderRadius = "12px";
  } else {
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
  }

  return iframe;
}

/**
 * Creates the background overlay UI
 */
export function createBackdrop(id?: string): HTMLDivElement {
  const backdropElem = document.createElement("div");
  if (id) {
    backdropElem.id = id;
  }

  backdropElem.style.position = "absolute";
  backdropElem.style.top = "0";
  backdropElem.style.left = "0";
  backdropElem.style.width = "100%";
  backdropElem.style.height = "100%";
  backdropElem.style.display = "flex";
  backdropElem.style.flexDirection = "column";
  backdropElem.style.justifyContent = "center";
  backdropElem.style.zIndex = "9999";
  backdropElem.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
  backdropElem.style.flexWrap = "wrap";
  backdropElem.style.alignContent = "center";
  backdropElem.style.alignItems = "center";
  backdropElem.style.fontFamily = "'Roboto', 'Arial', sans-serif";

  return backdropElem;
}
