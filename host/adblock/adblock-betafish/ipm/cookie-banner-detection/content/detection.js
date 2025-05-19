/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * This script will be injected into the main world of a the top-level frame
 * of a website.
 *
 * It will use the TCF API to detect cookie banner. For more on the TCF API,
 * please see https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md
 */
export function setupDetection() {
  /**
   * The name of the CustomEvent sent from main to isolated world.
   */
  const detectionEventName = "CookieBannerDetected";
  /**
   * The name of the key where the TCF API is going to be found at.
   */
  const tcfKeyName = "__tcfapi";

  /**
   * The points in time after this script is executed when we check for the
   * TCF API. Values are in ms.
   */
  const detectionPoints = [500, 1000, 2000];

  /**
   * Whether we are done with looking for the TCF API and setting up listeners.
   */
  let isSetupComplete = false;

  /**
   * Checks whether the TCF API is available.
   *
   * @returns Whether the TFC API is available
   */
  function hasTCF() {
    return typeof window[tcfKeyName] !== "undefined";
  }

  /**
   * Sets up the TCF API listener
   */
  function setupListener() {
    try {
      if (window[tcfKeyName]) {
        window[tcfKeyName]("addEventListener", 2, handleTCFEvent);
        isSetupComplete = true;
      }
    } catch (_) {
      // No way to recover from this.
    }
  }

  /**
   * Takes an TCF event and checks if it is an event that means that a cookie
   * consent banner has just been shown.
   *
   * @param tcData The TCData passed from the API
   * @param success Whether the API could process our request
   */
  function handleTCFEvent(tcData, success) {
    if (!success || tcData.eventStatus !== "cmpuishown") {
      return;
    }

    document.dispatchEvent(new CustomEvent(detectionEventName));
    if (window[tcfKeyName]) {
      window[tcfKeyName]("removeEventListener", 2, () => {}, tcData.listenerId);
    }
  }

  /**
   * Checks if the TCF API is present, and if so, sets up a listener for TCF
   * events.
   */
  function detectCookieBanners() {
    if (!hasTCF()) {
      return;
    }

    setupListener();
  }

  /**
   * Starts the cookie banner detection feature
   */
  function start() {
    const timerIds = detectionPoints.map((delay) =>
      setTimeout(() => {
        if (isSetupComplete) {
          timerIds.forEach((timerId) => clearTimeout(timerId));
          return;
        }
        detectCookieBanners();
      }, delay),
    );
  }

  start();
}
