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
import { youTubeWallDetected, youTubeNavigation } from "../shared/index.js";

/**
 * CSS selector identifying YouTube ad wall element
 */
const adWallSelector = "ytd-enforcement-message-view-model";

/**
 * CSS selector identifying YouTube Avatar element
 */
const userAvatarSelector = "button#avatar-btn";

/**
 * Ad wall mutation observer
 */
let adWallObserver: MutationObserver;

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
  adWallObserver.disconnect();

  const videoPlayer = document.querySelector("video");
  const currentPlaybackTime = videoPlayer?.currentTime ?? 0;
  const userLoggedIn = document.querySelectorAll(userAvatarSelector).length > 0;
  void browser.runtime.sendMessage({
    type: youTubeWallDetected,
    userLoggedIn,
    currentPlaybackTime,
    hasDismiss,
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

      // cover this element or anything inside it
      const matchNode = node.matches(adWallSelector)
        ? node
        : node.querySelector(adWallSelector);

      if (matchNode) {
        const hasDismiss = !!matchNode.querySelector("#dismiss-button");
        void adWallSelectorFound(hasDismiss);
        // Exit early if we found a matching element
        return;
      }
    }
  }
}

/**
 * Initializes YouTube ad wall detection feature
 */
function initializeObserver(): MutationObserver {
  /**
   * Mutation observer to detect when a matching element gets added to the DOM
   */
  const observer = new MutationObserver(handleMutations);
  observer.observe(document, {
    attributes: false,
    childList: true,
    characterData: false,
    subtree: true,
  });

  return observer;
}

/**
 * Send the initial navigation message to background page
 */
function logInitialEvent(): void {
  const userLoggedIn = document.querySelectorAll(userAvatarSelector).length > 0;
  void browser.runtime.sendMessage({ type: youTubeNavigation, userLoggedIn });
}

/**
 * Handle the load event
 */
function handleLoadEvent(): void {
  window.onload = null;
  setTimeout(() => {
    logInitialEvent();
  }, 5000);
}

/**
 * Check if the content script is in the top most document
 * if not, stop
 */
function checkWindow(): void {
  if (window.parent !== window) {
    return;
  }
  window.onload = handleLoadEvent;
}

/**
 * Initializes YouTube ad wall detection feature
 */
export function start(): void {
  adWallObserver = initializeObserver();
  checkWindow();
}
