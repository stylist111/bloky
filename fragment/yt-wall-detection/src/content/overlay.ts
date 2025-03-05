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
import {
  ytHavenModalFlag,
  ytHavenNeverShowOverlayClick,
  ytHavenOverlayFlag,
  ytHavenWatchCTAClicked,
} from "../shared/index.js";
import { getExperimentFlag } from "./shared.js";
import { addVideoModal } from "./modal-player.js";
import { abpLogo } from "../img/abp-logo.js";
import { abLogo } from "../img/ab-logo.js";
import { stopPause } from "./pause-video.js";

/**
 * The extension name from manifest
 */
const { short_name: extName } = browser.runtime.getManifest();

let videoOverlay: HTMLElement;

/**
 * Creates the background overlay UI
 */
function createOverlayUI(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "900";
  overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
  overlay.style.flexWrap = "wrap";
  overlay.style.alignContent = "center";
  overlay.style.fontFamily = "'Roboto', 'Arial', sans-serif";
  overlay.style.alignItems = "center";

  return overlay;
}

/**
 * Creates the extension logo
 */
function createLogo(): HTMLElement {
  let extLogo = abLogo;
  if (extName === "Adblock Plus") {
    extLogo = abpLogo;
  }

  // Create the logo image
  const logo = document.createElement("div");
  logo.innerHTML = extLogo;
  logo.style.marginBottom = "20px";

  return logo;
}

/**
 * Creates the title
 */
function createTitle(): HTMLElement {
  const title = document.createElement("span");
  title.innerText = "Oops, we detected some ads. We got you!";
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
  message.innerText = `You know who, wants to show you ads, but we think you deserve better.
   With us, you can watch your favorite videos without interruptions — just press watch and enjoy.`;

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
  watchButton.innerText = `Watch with ${extName}`;

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
  neverShowButton.style.backgroundColor = "#ffffff1a";
  neverShowButton.style.color = "#fff";
  neverShowButton.style.marginLeft = "10px";
  neverShowButton.innerText = "Never show this again";

  neverShowButton.addEventListener("mouseover", () => {
    neverShowButton.style.backgroundColor = "#ffffff33";
  });

  neverShowButton.addEventListener("mouseout", () => {
    neverShowButton.style.backgroundColor = "#ffffff1a";
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
  const overlay = createOverlayUI();
  const logo = createLogo();
  const title = createTitle();
  const message = createMessage();
  const buttonContainer = createCTAButtons(watchHandler, neverShowHandler);

  overlay.appendChild(logo);
  overlay.appendChild(title);
  overlay.appendChild(message);
  overlay.appendChild(buttonContainer);

  return overlay;
}

export async function insertOverlayExp(
  videoContainer: HTMLElement,
): Promise<void> {
  const isOverlayIframeExp = await getExperimentFlag(ytHavenOverlayFlag);
  const isOverlayModalExp = await getExperimentFlag(ytHavenModalFlag);

  if (!isOverlayIframeExp && !isOverlayModalExp) {
    return;
  }

  const watchHandler = (): void => {
    if (isOverlayIframeExp) {
      // TODO: insert video iframe on page here
      // insertIframeOnPage();
    } else {
      const body = document.querySelector<HTMLElement>("body");
      if (body) {
        addVideoModal(body);
      }
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
}

/**
 * Removes the video overlay
 */
export function removeOverlayExperiment(): void {
  videoOverlay?.parentElement?.removeChild(videoOverlay);
}
