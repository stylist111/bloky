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
  youTubeWallDetected,
  youTubeNavigation,
  toastShownEvent,
  errorEvent,
  ErrorType,
} from "../shared/index.js";
import { recordEvent } from "./shared.js";

// CSS selector identifying YouTube ad wall element
const adWallSelector = "ytd-enforcement-message-view-model";

// CSS selector identifying YouTube player error element
const playerErrorSelectors = [".ytp-error", "#player-error-message-container"];

// CSS selector identifying YouTube Avatar element
const userAvatarSelector = "button#avatar-btn";

// CSS selector identifying the toast notification
const toastSelector =
  ".yt-notification-action-renderer a[href*='check_ad_blockers']";

// Flag to indicate whether the wall has been detected
let wallDetected = false;

// DOM mutation observer to lookup for video elements and wall
let domObserver: MutationObserver;

// Symbol to prevent multiple logging of the same event
const alreadyLoggedSymbol = Symbol("alreadyLoggedSymbol");

// Type for elements that can be marked as already logged
type LoggableElement = Element & { [alreadyLoggedSymbol]?: boolean };

/**
 * Checks whether given candidate is a DOM element
 *
 * @param candidate - Candidate
 *
 * @returns whether given candidate is a DOM element
 */
function isElement(candidate: unknown): candidate is Element {
  return candidate instanceof Element;
}

/**
 * Send a message to SW when the add wall has been found
 */
async function adWallSelectorFound(hasDismiss: boolean): Promise<void> {
  const videoPlayer = document.querySelector("video");
  const currentPlaybackTime = videoPlayer?.currentTime ?? 0;
  const userLoggedIn = !!document.querySelector(userAvatarSelector);
  void browser.runtime.sendMessage({
    type: youTubeWallDetected,
    userLoggedIn,
    currentPlaybackTime,
    hasDismiss,
  });
}

/**
 * Handles the toast notification when it appears.
 * This function will log the event only once per toast notification.
 * @param node
 */
async function handleToastNotification(node: Element): Promise<void> {
  const toastNode = node as LoggableElement;

  // If we already logged this toast, skip it
  if (toastNode[alreadyLoggedSymbol]) {
    return;
  }

  toastNode[alreadyLoggedSymbol] = true;
  void recordEvent(toastShownEvent);
}

/**
 * Handles the player error when it appears.
 * This function will log the event only once per error, even if multiple
 * error selectors match different elements on the page.
 * @param node
 */
async function handlePlayerError(node: Element): Promise<void> {
  const errorNode = node as LoggableElement;

  // If we already logged this error element, skip it
  if (errorNode[alreadyLoggedSymbol]) {
    return;
  }

  // Check if any other player error element has already been logged
  const allErrorElements = document.querySelectorAll(
    playerErrorSelectors.join(","),
  );
  for (const elem of allErrorElements) {
    const typedElem = elem as LoggableElement;
    if (typedElem !== errorNode && typedElem[alreadyLoggedSymbol]) {
      // Another error element was already logged, mark this one and skip
      errorNode[alreadyLoggedSymbol] = true;
      return;
    }
  }

  errorNode[alreadyLoggedSymbol] = true;

  void recordEvent(errorEvent, {
    category: ErrorType.PLAYER_ERROR,
    applicationVersion: "",
    error: "",
    error_msg: "",
  });
}

/**
 * Handles DOM modifications to check whether a matching element got added
 * to the DOM
 *
 * @param mutations - DOM modifications
 */
function handleMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!isElement(node)) {
        continue;
      }

      // Use a single traversal to find all elements of interest
      const elements = [
        node,
        ...Array.from(
          node.querySelectorAll(
            [adWallSelector, toastSelector, ...playerErrorSelectors].join(","),
          ),
        ),
      ];

      for (const elem of elements) {
        if (elem.tagName === adWallSelector.toUpperCase() && !wallDetected) {
          const hasDismiss = !!elem.querySelector("#dismiss-button");
          void adWallSelectorFound(hasDismiss);
          wallDetected = true;
        } else if (elem.tagName === "A" && elem.matches(toastSelector)) {
          void handleToastNotification(elem);
        } else if (
          elem.tagName === "DIV" &&
          elem.matches(playerErrorSelectors.join(","))
        ) {
          void handlePlayerError(elem);
        }
      }
    }
  }
}

/**
 * Initializes YouTube DOM observers
 */
function initializeObserver(): void {
  // Mutation observer to detect when a matching element gets added to the DOM
  domObserver = new MutationObserver(handleMutations);
  domObserver.observe(document, {
    attributes: false,
    childList: true,
    characterData: false,
    subtree: true,
  });
}

/**
 * Send the initial navigation message to background page
 */
function logInitialEvent(): void {
  const userLoggedIn = !!document.querySelector(userAvatarSelector);
  void browser.runtime.sendMessage({ type: youTubeNavigation, userLoggedIn });
}

/**
 * Handle the load event
 */
function handleLoadEvent(): void {
  setTimeout(() => {
    logInitialEvent();
  }, 5000);
}

/**
 * Initializes YouTube ad wall detection feature
 */
export function start(): void {
  initializeObserver();

  // Listener for when the page is loaded. Will be called only once.
  window.addEventListener("load", handleLoadEvent, { once: true });
}
