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
  ytHavenModalFlag,
  ytHavenNeverShowOverlayClick,
  ytHavenOverlayFlag,
  ytHavenOverlayShown,
  ytHavenWatchCTAClicked,
} from "../shared/index.js";
import {
  createIframePlayer,
  createBackdrop,
  getExperimentFlag,
  videoContextStore,
  createLogoSVG,
} from "./shared.js";
import { addVideoModal, removeVideoModal } from "./modal-player.js";
import { stopPause } from "./pause-video.js";
import { removeEmbedPlayer } from "./embed-haven.js";

/**
 * The extension name from manifest
 */
const { short_name: extName } = browser.runtime.getManifest();

let videoOverlay: HTMLElement;

/**
 * Creates the title
 */
function createTitle(): HTMLElement {
  const title = document.createElement("span");
  title.innerText = browser.i18n.getMessage("yt_haven_overlay_title", extName);
  title.style.fontWeight = "500";
  title.style.fontSize = "20px";
  title.style.marginBottom = "20px";
  title.style.color = "#fff";

  return title;
}

/**
 * Creates the user facing message
 */
function createMessage(): HTMLElement {
  const message = document.createElement("span");
  message.style.maxWidth = "600px";
  message.style.color = "#fff";
  message.style.fontSize = "14px";
  message.style.lineHeight = "24px";
  message.style.fontFamily = "'Roboto', 'Arial', sans-serif";
  message.style.textAlign = "center";
  message.style.marginBottom = "20px";
  message.innerText = browser.i18n.getMessage(
    "yt_haven_overlay_description",
    extName,
  );

  return message;
}

/**
 * Creates a button element
 *
 * @param clickHandler The click handler for the button
 */
function createButton(clickHandler: () => void): HTMLElement {
  const button = document.createElement("button");
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.lineHeight = "36px";
  button.style.borderRadius = "18px";
  button.style.border = "none";
  button.style.fontWeight = "500";
  button.style.padding = "0 16px";
  button.style.fontFamily = "'Roboto', 'Arial', sans-serif";

  button.addEventListener("click", () => {
    clickHandler();
  });

  return button;
}

/**
 * Creates the watch in player button
 *
 * @param clickHandler The click handler for the button
 */
function createWatchButton(clickHandler: () => void): HTMLElement {
  const watchButton = createButton(clickHandler);
  watchButton.style.color = "#000";
  watchButton.style.background = "#f1f1f1";
  watchButton.innerText = browser.i18n.getMessage(
    "yt_haven_overlay_cta_button",
    extName,
  );

  watchButton.addEventListener("mouseover", () => {
    watchButton.style.backgroundColor = "#d9d9d9";
  });

  watchButton.addEventListener("mouseout", () => {
    watchButton.style.backgroundColor = "#f1f1f1";
  });

  return watchButton;
}

/**
 * Creates the never show button
 *
 * @param clickHandler The click handler for the button
 */
function createNeverShowButton(clickHandler: () => void): HTMLElement {
  const neverShowButton = createButton(clickHandler);
  neverShowButton.style.backgroundColor = "#333";
  neverShowButton.style.color = "#fff";
  neverShowButton.style.marginLeft = "10px";
  neverShowButton.innerText = browser.i18n.getMessage(
    "yt_haven_overlay_never_button",
  );

  neverShowButton.addEventListener("mouseover", () => {
    neverShowButton.style.backgroundColor = "#555";
  });

  neverShowButton.addEventListener("mouseout", () => {
    neverShowButton.style.backgroundColor = "#333";
  });

  return neverShowButton;
}

/**
 * Creates the buttons.
 *
 * @param watchHandler Action for the watch in player button
 * @param neverShowHandler Action for the watch in player button
 */
function createCTAButtons(
  watchHandler: () => void,
  neverShowHandler: () => void,
): HTMLElement {
  const watchButton = createWatchButton(watchHandler);
  const neverShowButton = createNeverShowButton(neverShowHandler);
  const buttonContainer = document.createElement("div");
  buttonContainer.appendChild(watchButton);
  buttonContainer.appendChild(neverShowButton);

  return buttonContainer;
}

/**
 * Creates the overlay on the video.
 *
 * @param watchHandler Action for the watch in player button
 * @param neverShowHandler Action for the watch in player button
 */
function getVideoOverlay(
  watchHandler: () => void,
  neverShowHandler: () => void,
): HTMLDivElement {
  const backdropElem = createBackdrop();
  const logoElem = createLogoSVG();
  logoElem.style.marginBottom = "1.25rem";
  logoElem.style.display = "block";
  logoElem.style.height = "3.75rem";

  const titleElem = createTitle();
  const descriptionElem = createMessage();
  const buttonContainer = createCTAButtons(watchHandler, neverShowHandler);

  backdropElem.appendChild(logoElem);
  backdropElem.appendChild(titleElem);
  backdropElem.appendChild(descriptionElem);
  backdropElem.appendChild(buttonContainer);

  return backdropElem;
}

export async function insertOverlayExp(
  videoContainer: HTMLElement,
): Promise<void> {
  const isOverlayIframeExp = await getExperimentFlag(ytHavenOverlayFlag);
  const isOverlayModalExp = await getExperimentFlag(ytHavenModalFlag);

  if (!isOverlayIframeExp && !isOverlayModalExp) {
    return;
  }

  // Remove any previous added video overlay
  removeVideoOverlay();

  const watchHandler = (): void => {
    if (isOverlayIframeExp) {
      // Cleanup previous video overlays (if any), we only want to this here because
      // if the user is in the modal experiment, we want to keep the overlay
      // after the modal is closed
      removeVideoOverlay();

      const { videoId, playlistId, startSeconds } =
        videoContextStore.getVideoContext();

      const playerElem = createIframePlayer({
        videoId,
        playlistId,
        startSeconds,
        showWatchingWith: true,
      });

      videoContainer.appendChild(playerElem);
    } else {
      // show modal with the embedded player
      addVideoModal(document.body);
    }

    void browser.runtime.sendMessage({
      type: ytHavenWatchCTAClicked,
    });
  };

  const neverShowHandler = (): void => {
    void browser.runtime.sendMessage({
      type: ytHavenNeverShowOverlayClick,
    });

    stopPause();
    videoOverlay?.parentElement?.removeChild(videoOverlay);
  };

  videoOverlay = getVideoOverlay(watchHandler, neverShowHandler);

  videoContainer.style.position = "relative";
  videoContainer.style.overflow = "hidden";
  videoContainer.appendChild(videoOverlay);

  void browser.runtime.sendMessage({
    type: ytHavenOverlayShown,
  });
}

/**
 * Removes the video overlay and depending on which experiment the user might be in,
 * it cleans up the modal and the embedded player.
 */
export function removeVideoOverlay(): void {
  videoOverlay?.parentElement?.removeChild(videoOverlay);
  removeEmbedPlayer();
  removeVideoModal();
}
