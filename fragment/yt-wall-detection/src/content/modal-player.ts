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
import { closeIcon } from "../img/close.js";
import {
  createIframePlayer,
  createBackdrop,
  videoContextStore,
  createLogoSVG,
} from "./shared.js";
import { ytHavenModalClosed } from "../shared/index.js";

/**
 * The modal ID with the embedded player
 */
const modalId = "yt-haven-modal";

/**
 * Creates a close button for the modal
 * @returns The close button element
 */
function createCloseButton(): HTMLElement {
  const closeButton = document.createElement("button");
  closeButton.ariaLabel = "close overlay";
  closeButton.innerHTML = closeIcon;
  closeButton.style.position = "absolute";
  closeButton.style.top = "1rem";
  closeButton.style.right = "1rem";
  closeButton.style.cursor = "pointer";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  return closeButton;
}

/**
 * Creates the branding element
 */
function createBrandingElement(): HTMLElement {
  const logo = createLogoSVG();
  logo.style.height = "1.875rem";

  const brandingElement = document.createElement("div");
  brandingElement.style.marginTop = "2rem";
  brandingElement.style.color = "#FFF";
  brandingElement.style.fontSize = "1.25rem";
  brandingElement.style.display = "flex";
  brandingElement.style.alignItems = "center";
  brandingElement.style.gap = "1rem";
  brandingElement.innerText = browser.i18n.getMessage(
    "yt_haven_player_watching_with_label",
  );
  brandingElement.appendChild(logo);

  return brandingElement;
}

/**
 * Adds the video modal to the target element
 * @param targetElement
 */
export function addVideoModal(targetElement: HTMLElement): void {
  const modalContainer = createBackdrop(modalId);
  modalContainer.style.position = "fixed";
  modalContainer.style.zIndex = "999999";

  const closeButton = createCloseButton();
  const brandingElem = createBrandingElement();

  const { videoId, playlistId, startSeconds } =
    videoContextStore.getVideoContext();

  const playerElem = createIframePlayer({
    videoId,
    playlistId,
    startSeconds,
    showInModal: true,
  });

  modalContainer.appendChild(closeButton);
  modalContainer.appendChild(playerElem);
  modalContainer.appendChild(brandingElem);
  targetElement.appendChild(modalContainer);

  function handleModalClose(): void {
    targetElement.removeChild(modalContainer);
    void browser.runtime.sendMessage({
      type: ytHavenModalClosed,
    });
  }

  function closeModalOnKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      handleModalClose();
      targetElement.removeEventListener("keydown", closeModalOnKeydown);
    }
  }

  function closeModalOnClick(evt: MouseEvent): void {
    if ((evt.target as HTMLDivElement)?.id === modalId) {
      handleModalClose();
      targetElement.removeEventListener("click", closeModalOnClick);
    }
  }

  function closeModalButtonClick(): void {
    handleModalClose();
    closeButton.removeEventListener("click", closeModalButtonClick);
  }

  closeButton.addEventListener("click", closeModalButtonClick);
  targetElement.addEventListener("keydown", closeModalOnKeydown);
  targetElement.addEventListener("click", closeModalOnClick);
}

/**
 * Remove the video modal
 */
export function removeVideoModal(): void {
  const modalContainer = document.getElementById(modalId);
  modalContainer?.parentElement?.removeChild(modalContainer);
}
