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
  ytHavenToggleState,
  ytHavenShouldStart,
  ytHavenRecordEvent,
} from "../shared/index.js";
import type {
  IframePlayerConfig,
  VideoContext,
  VideoContextStoreType,
} from "./shared.types.js";
import { abpLogo } from "../img/abp-logo.js";
import { abLogo } from "../img/ab-logo.js";

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
 * Checks if the user is in one of the YT Haven experiments
 */
export async function isInHavenExperiment(): Promise<boolean> {
  return await browser.runtime.sendMessage({ type: ytHavenShouldStart });
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
    // The z-index is set to 500 to make sure that the iframe is above the video
    // when 3rd party extensions like Enhancer for YouTube are used
    iframe.style.zIndex = "500";
  }

  // Notify the iframe player API that main window is ready to listen for events
  iframe.onload = function () {
    setTimeout(() => {
      iframe?.contentWindow?.postMessage('{"event":"listening"}', "*");
    });
  };

  return iframe;
}

/**
 * Creates the extension logo
 */
export function createLogoSVG(): HTMLElement {
  const { short_name: extName } = browser.runtime.getManifest();

  let extLogo = abLogo;
  if (extName === "Adblock Plus") {
    extLogo = abpLogo;
  }

  // Create the logo image
  const logo = document.createElement("div");
  logo.innerHTML = extLogo;

  return logo.firstChild as HTMLElement;
}

/**
 * Retrieves the toggle state from the background page
 */
export const getToggleState = async (): Promise<boolean> => {
  return await browser.runtime.sendMessage({
    type: ytHavenToggleState,
  });
};

/**
 * Checks if the dark mode is enabled
 */
export function isDarkMode(): boolean {
  const docAttr = document.documentElement.getAttribute("dark");
  const ytdApp = document.querySelector("ytd-app");

  return docAttr !== null || (ytdApp !== null && ytdApp.hasAttribute("dark"));
}

/**
 * Wrapper over the sendMessage function to record events
 * @param {string} eventName - The name of the event to record
 * @param {object} [eventPayload] - The payload of the event
 */
export async function recordEvent(
  eventName: string,
  eventPayload?: object,
): Promise<void> {
  void browser.runtime.sendMessage({
    type: ytHavenRecordEvent,
    eventName,
    eventPayload,
  });
}
