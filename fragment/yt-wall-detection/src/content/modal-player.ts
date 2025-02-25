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

function createModalBackground(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.setAttribute("id", "overlay");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9000";
  overlay.style.backgroundColor = "rgba(55,55,55,0.9)";
  overlay.style.flexWrap = "wrap";
  overlay.style.alignContent = "center";
  overlay.style.fontFamily = "'Roboto', 'Arial', sans-serif"; // depends on extension
  overlay.style.alignItems = "center";

  return overlay;
}

function createVideoPlayer(): HTMLElement {
  const url = new URL(window.top?.location?.href ?? "");
  const videoId = url.searchParams.get("v");

  const player = document.createElement("iframe");
  player.src = `https://www.youtube-nocookie.com/embed/${videoId}?controls=1&autoplay=1`;
  player.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  player.allowFullscreen = true;
  player.style.width = "80%";
  player.style.aspectRatio = "16/9";
  return player;
}

export function addVideoModal(body: HTMLElement): void {
  const overlay = createModalBackground();
  const closeButton = createCloseButton();
  const player = createVideoPlayer();

  overlay.appendChild(closeButton);
  overlay.appendChild(player);
  body.appendChild(overlay);

  function closeModalOnKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      body.removeChild(overlay);
      body.removeEventListener("keydown", closeModalOnKeydown);
    }
  }

  function closeModalOnClick(evt: MouseEvent): void {
    if ((evt.target as HTMLDivElement)?.id === "overlay") {
      body.removeChild(overlay);
      body.removeEventListener("click", closeModalOnClick);
    }
  }

  function closeModalButtonClick(): void {
    body.removeChild(overlay);
    closeButton.removeEventListener("click", closeModalButtonClick);
  }

  closeButton.addEventListener("click", closeModalButtonClick);
  body.addEventListener("keydown", closeModalOnKeydown);
  body.addEventListener("click", closeModalOnClick);
}
