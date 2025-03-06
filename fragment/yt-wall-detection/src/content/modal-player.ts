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

import { closeIcon } from "../img/close.js";
import {
  createIframePlayer,
  createBackdrop,
  videoContextStore,
} from "./shared.js";

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
 * Adds the video modal to the target element
 * @param targetElement
 */
export function addVideoModal(targetElement: HTMLElement): void {
  const modalContainer = createBackdrop(modalId);
  const closeButton = createCloseButton();

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
  targetElement.appendChild(modalContainer);

  function closeModalOnKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      targetElement.removeChild(modalContainer);
      targetElement.removeEventListener("keydown", closeModalOnKeydown);
    }
  }

  function closeModalOnClick(evt: MouseEvent): void {
    if ((evt.target as HTMLDivElement)?.id === modalId) {
      targetElement.removeChild(modalContainer);
      targetElement.removeEventListener("click", closeModalOnClick);
    }
  }

  function closeModalButtonClick(): void {
    targetElement.removeChild(modalContainer);
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
