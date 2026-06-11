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

import type { YTEventData } from "./shared.types.js";
import {
  ytHavenFeedbackMenuOpen,
  ytHavenIframeShown,
  ytHavenInfoBoxShown,
  ytHavenNextVideoNotFound,
  ytHavenToggleStateUpdate,
} from "../shared/index.js";
import { resumeCurrentVideo, startPause, stopPause } from "./pause-video.js";
import {
  createIframePlayer,
  createLogoSVG,
  getIframePlayer,
  getToggleState,
  isDarkMode,
  isInHavenExperiment,
  recordEvent,
  videoContextStore,
} from "./shared.js";
import { menuIcon } from "../img/menu.js";
import { checkIcon } from "../img/check.js";
import { crossIcon } from "../img/cross.js";

/**
 * Enum with the player state
 * Docs: https://developers.google.com/youtube/iframe_api_reference#onStateChange
 */
enum PlayerState {
  ENDED = 0,
}

const infoBoxId = "yt-haven-info-box";

/**
 * URL to the survey for feedback
 * This is used in the feedback menu
 */
const SURVEY_URL = "https://survey.alchemer.eu/s3/90847063/Quick-Feedback";

/**
 * Attempts to load the next video when the current video in the embedded player has ended
 */
async function handleEmbeddedVideoEnding(): Promise<void> {
  const { nextVideoId, autoplayEnabled, playlistId } =
    videoContextStore.getVideoContext();

  // If autoplay is disabled and there is no playlist, do nothing
  // aka. playlists are always autoplay enabled
  if (!autoplayEnabled && !playlistId) {
    return;
  }

  const nextVideoAnchor = document.querySelector(
    "#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-left-controls > a.ytp-next-button.ytp-button",
  );

  if (
    nextVideoAnchor &&
    nextVideoAnchor instanceof HTMLAnchorElement &&
    nextVideoAnchor.href
  ) {
    nextVideoAnchor.click();
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);

  if (nextVideoId) {
    searchParams.set("v", nextVideoId);
    window.location.search = searchParams.toString();
    return;
  }

  removeEmbedPlayer();
  resumeCurrentVideo();
  void browser.runtime.sendMessage({
    type: ytHavenNextVideoNotFound,
  });
}

/**
 * Process messages from the embedded YT iFrame
 * @param {MessageEvent} event The event message from the embedded player
 */
const iFrameMessageListener = (event: MessageEvent): void => {
  const playerElem = getIframePlayer();

  if (
    playerElem &&
    playerElem instanceof HTMLIFrameElement &&
    event.source === playerElem.contentWindow &&
    "data" in event &&
    typeof event.data === "string"
  ) {
    const eventData: YTEventData = JSON.parse(event.data);
    const playerState = eventData?.info?.playerState;

    if (playerState === PlayerState.ENDED) {
      void handleEmbeddedVideoEnding();
    }
  }
};

/**
 * Add the YT embedded iframe element with video id obtained from the current URL
 *
 * @param targetElement An existing DOM element which to overlay the iframe which will contain the embedded player
 */
export async function addEmbedVideoOnTop(
  targetElement: HTMLElement,
): Promise<void> {
  const { videoId, startSeconds } = videoContextStore.getVideoContext();

  let playerElem = getIframePlayer();
  if (!(playerElem instanceof HTMLIFrameElement)) {
    removeEmbedPlayer();
  }

  // This event will be triggered when the iframe is first added,
  // but also when the user navigates to another video and the iframe
  // already exists in the DOM
  void recordEvent(ytHavenIframeShown);

  if (playerElem && playerElem instanceof HTMLIFrameElement) {
    // This message is being sent to the YT JS code in the embedded iframe.
    // It is a bit of hack
    // This is a link to the similar function the YT Frame API
    // https://developers.google.com/youtube/iframe_api_reference#loadVideoById
    playerElem.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: "loadVideoById",
        args: [videoId, startSeconds],
      }),
      "*",
    );
    return;
  }

  playerElem = createIframePlayer({
    videoId,
    startSeconds,
  });

  window.addEventListener("message", (event: MessageEvent): void => {
    iFrameMessageListener(event);
  });

  targetElement.style.position = "relative";
  targetElement.style.overflow = "hidden";
  targetElement.appendChild(playerElem);
}

/**
 * Creates a toggle switch element
 *
 * @param {boolean} initialState - The initial state of the toggle switch
 * @param {Function} onToggle - The callback function to be called when the toggle state changes
 */
function createToggleSwitch(
  initialState: boolean = false,
  onToggle: (state: boolean) => Promise<void> = async () => {},
): HTMLDivElement {
  let isActive = initialState;
  const colors = {
    // ENABLED: "#34d399"
    ENABLED: "#3c5b81",
    DISABLED: isDarkMode() ? "rgba(255, 255, 255, 0.15)" : "#b0c0d1",
  };

  // Create toggle container
  const toggle = document.createElement("div");
  Object.assign(toggle.style, {
    width: "36px",
    height: "18px",
    backgroundColor: initialState ? colors.ENABLED : colors.DISABLED,
    borderRadius: "18px",
    position: "relative",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
    display: "inline-block",
    flex: "none",
  });

  // Create toggle thumb
  const thumb = document.createElement("div");
  Object.assign(thumb.style, {
    width: "18px",
    height: "18px",
    backgroundColor: "#ffffff",
    color: "#666",
    borderRadius: "50%",
    position: "absolute",
    top: "0px",
    left: initialState ? "18px" : "0px",
    boxShadow: "0 0 6px rgba(0, 0, 0, 0.2)",
    transition: "left 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  // initial icon
  thumb.innerHTML = isActive ? checkIcon : crossIcon;

  toggle.appendChild(thumb);

  // toggle logic
  toggle.addEventListener("click", () => {
    const newState = !isActive;
    if (newState !== isActive) {
      isActive = newState;
      toggle.style.backgroundColor = isActive
        ? colors.ENABLED
        : colors.DISABLED;
      thumb.style.left = isActive ? "18px" : "0px";
      thumb.innerHTML = isActive ? checkIcon : crossIcon;
      void onToggle(isActive);
    }
  });

  return toggle;
}

function createMenuComponent(): HTMLDivElement {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    display: "inline-block",
  });

  // Trigger button
  const menuButton: HTMLDivElement = document.createElement("div");
  menuButton.innerHTML = menuIcon;
  Object.assign(menuButton.style, {
    cursor: "pointer",
    width: "24px",
    textAlign: "center",
    fontSize: "24px",
  });

  // Menu dropdown
  const menu: HTMLDivElement = document.createElement("div");
  Object.assign(menu.style, {
    display: "none",
    position: "absolute",
    top: "0",
    right: "0",
    transform: "translateY(-100%)",
    background: isDarkMode() ? "#222" : "#FFF",
    borderRadius: "12px",
    padding: "8px 0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    width: "256px",
    color: isDarkMode() ? "#FFF" : "#000",
    fontSize: "14px",
    zIndex: "1000",
  });

  // Helper to create items
  const createItem = (
    emoji: string,
    i18nKey: string,
    href: string = "",
  ): HTMLDivElement => {
    const item = document.createElement("div");
    item.textContent = `${emoji} ${browser.i18n.getMessage(i18nKey)}`;
    Object.assign(item.style, {
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      cursor: "pointer",
    });

    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = isDarkMode()
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(0, 0, 0, 0.15)";
    });

    item.addEventListener("mouseleave", () => {
      // Reset to hover background
      item.style.backgroundColor = "";
    });

    item.addEventListener("click", () => {
      // close the menu
      menu.style.display = "none";
      // record feedback menu item clicked
      void recordEvent(i18nKey);
      if (href) {
        // If href is provided, navigate to it
        window.open(href, "_blank");
      }
    });

    return item;
  };

  menu.appendChild(createItem("😍", "yt_haven_feedback_love"));
  menu.appendChild(createItem("🥲", "yt_haven_feedback_fix_it", SURVEY_URL));
  menu.appendChild(createItem("👎", "yt_haven_feedback_hate", SURVEY_URL));

  // Toggle menu
  menuButton.addEventListener("click", () => {
    menu.style.display = menu.style.display === "block" ? "none" : "block";

    // record feedback menu open
    if (menu.style.display === "block") {
      void recordEvent(ytHavenFeedbackMenuOpen);
    }
  });

  // Close on outside click
  window.addEventListener("click", (e: MouseEvent) => {
    if (!container.contains(e.target as Node)) {
      menu.style.display = "none";
    }
  });

  // Assemble
  container.appendChild(menuButton);
  container.appendChild(menu);

  return container;
}

/**
 * Inserts the info box into the page, between the video player and
 * the video title
 *
 * @param {HTMLElement} targetContainer - The container to insert the info box into
 * @param {boolean} toggleState - The state of the toggle switch
 * @param {Function} onToggle - The callback function to be called when the toggle state changes
 */
function addInfoBox(
  targetContainer: HTMLElement,
  toggleState: boolean,
  onToggle: (state: boolean) => Promise<void>,
): void {
  // Remove the info box, if it already exists
  removeInfoBox();

  const infoBoxElem = document.createElement("div");
  infoBoxElem.id = infoBoxId;

  Object.assign(infoBoxElem.style, {
    marginTop: "12px",
    backgroundColor: isDarkMode() ? "#272727" : "#dff1fe",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    color: isDarkMode() ? "#fff" : "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "36px",
  });

  const logoElem = createLogoSVG();
  Object.assign(logoElem.style, {
    height: "20px",
    display: "block",
    marginBottom: "4px",
  });

  const actionContainer = document.createElement("div");
  Object.assign(actionContainer.style, {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: "none",
    borderLeft: `1px solid ${isDarkMode() ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
    paddingLeft: "18px",
  });

  const toggleContainer = document.createElement("div");
  Object.assign(toggleContainer.style, {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    gap: "6px",
    paddingTop: "12px",
  });

  const toggleElem = createToggleSwitch(toggleState, onToggle);
  toggleContainer.appendChild(toggleElem);

  const toggleLabel = document.createElement("div");
  Object.assign(toggleLabel.style, {
    textAlign: "center",
    fontSize: "12px",
    opacity: "0.5",
  });
  toggleLabel.innerText = browser.i18n.getMessage("yt_haven_toggle_label");
  toggleContainer.appendChild(toggleLabel);
  actionContainer.appendChild(toggleContainer);

  const menuElem = createMenuComponent();
  actionContainer.appendChild(menuElem);

  const infoElem = document.createElement("div");
  infoElem.innerText = browser.i18n.getMessage("yt_haven_info_box_description");
  infoElem.insertBefore(logoElem, infoElem.firstChild);

  infoBoxElem.appendChild(infoElem);
  infoBoxElem.appendChild(actionContainer);

  // insert the info box between the player and the video title
  targetContainer.insertBefore(infoBoxElem, targetContainer.firstChild);

  // record info box shown event
  void recordEvent(ytHavenInfoBoxShown);
}

/**
 * Initializes YouTube embedded video player
 */
export async function start(targetElement: HTMLElement): Promise<void> {
  const [isExpEnabled, toggleState] = await Promise.all([
    isInHavenExperiment(),
    getToggleState(),
  ]);
  const targetInfoContainer = document.querySelector<HTMLElement>("#below");

  // Do nothing if the user is not in experiment
  if (!isExpEnabled || !targetInfoContainer) {
    return;
  }

  const onToggle = async (newState: boolean): Promise<void> => {
    await browser.runtime.sendMessage({
      type: ytHavenToggleStateUpdate,
      newState,
    });

    if (newState) {
      startPause();
      void addEmbedVideoOnTop(targetElement);
    } else {
      stopPause();
      removeEmbedPlayer();
    }
  };

  addInfoBox(targetInfoContainer, Boolean(toggleState), onToggle);

  // show the embedded player by default
  if (toggleState) {
    void addEmbedVideoOnTop(targetElement);
  } else {
    stopPause();
    removeEmbedPlayer();
  }
}

/**
 * Removes the embedded player from the DOM
 */
export const removeEmbedPlayer = (): void => {
  const playerElem = getIframePlayer();
  playerElem?.parentNode?.removeChild(playerElem);
};

export const removeInfoBox = (): void => {
  const infoBoxElem = document.getElementById(infoBoxId);
  infoBoxElem?.parentNode?.removeChild(infoBoxElem);
};
