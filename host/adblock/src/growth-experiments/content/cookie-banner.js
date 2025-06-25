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
 * Runs the Cookie Banner Experiment.
 *
 * It will use the TCF API to detect cookie banner. For more on the TCF API,
 * please see https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md
 */
export function runCookieBannerExperiment(
  cmpMessageDetectedEventName,
  buttonInjectedEventName,
  buttonClickedEventName,
  logoIcon,
) {
  /**
   * ID for the custom consent button
   */
  const componentID = "adblock-cookie-banner-cta";

  /**
   * ID for the button CSS
   */
  const componentStyleSheetID = "adblock-cookie-banner-cta-styles";

  /**
   * The target URL for the new tab we open.
   */
  const targetURL = "https://getadblock.com/premium/?s=ipmcookie";

  /**
   * The delay between detecting the cookie banner and injecting the button in ms.
   */
  const injectionDelay = 200;

  /**
   * The name of the key where the TCF API is going to be found at.
   */
  const tcfKeyName = "__tcfapi";

  /**
   * The points in time after this script is executed when we check for the
   * TCF API. Values are in ms.
   */
  const detectionPoints = [300, 700, 1500, 2300];

  /**
   * Whether we are done with looking for the TCF API and setting up listeners.
   */
  let isSetupComplete = false;

  /**
   * Injects a ad component into the website.
   */
  function injectComponent() {
    const banner = document.getElementById("onetrust-banner-sdk");
    if (!banner || !banner.parentNode) {
      // The selector we look for doesn't exist anymore.
      return;
    }

    const bannerParent = banner.parentNode;

    const message = createConsentBannerBubble();
    updateBubblePosition(message, banner);

    if (message.hasAttribute("hidden")) {
      // the screen and banner size don't leave space to inject the bubble message
      return;
    }

    bannerParent.insertBefore(message, banner);

    // Ensure button stay on top of the banner on resize
    window.addEventListener("resize", () => {
      updateBubblePosition(message, banner);
    });
    document.dispatchEvent(new CustomEvent(buttonInjectedEventName));
  }

  /**
   * Creates a bubble message with a button to inject into the consent modal.
   */
  function createConsentBannerBubble() {
    const styleSheet = document.createElement("style");
    styleSheet.id = componentStyleSheetID;
    styleSheet.textContent = `
      .ab-bubble-container {
        position: fixed;
        z-index: 2147483645;
        padding: 10px 20px;
        background-color: #d0f2ff;
        border-radius: 10px;
        filter: drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.25));
        width: 150px;
      }
      
      .ab-bubble-container--side {
        animation: ab-cta-pop-in--side 500ms ease 1000ms both;
        -webkit-animation: ab-cta-pop-in--side 500ms ease 1000ms both;
      }
      
      .ab-bubble-container--side::after {
        content: "";
        position: absolute;
        bottom: 24px;
        left: -23px;
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 23px solid #d0f2ff;
      }
      
      .ab-bubble-container--top {
        animation: ab-cta-pop-in--top 500ms ease 1000ms both;
        -webkit-animation: ab-cta-pop-in--top 500ms ease 1000ms both;
      }
      
      .ab-bubble-container--top::after {
        content: "";
        position: absolute;
        right: 24px;
        bottom: -23px;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 23px solid #d0f2ff;
      }
      
      .ab-bubble-container__content{
        display: flex;
        flex-direction: column;
        align-self: stretch;
        gap: 10px;
      } 
      
      .ab-bubble-container__text {
        font-size: 16px;
        font-weight: 700;
        color: #000;
        text-align: left;
      }

      .ab-bubble-container__btn {
        padding: 7px 12px 7px 12px;
        border-radius: 6px;
        justify-content: center;
        align-items: center;
        color: #FFFFFF;
        background: #2284F7;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.75px;
        text-align: center;
      }

      @keyframes ab-cta-pop-in--top { 
        0% {
          opacity: 0;
          transform: translateY(50%) scale(0.25);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes ab-cta-pop-in--side { 
        0% {
          opacity: 0;
          transform: translateX(-50%) scale(0.25);
        } 
        100% {
          opacity: 1;
          transform: translateX(0) scale(1);
        } 
      }
    `;

    document.head.appendChild(styleSheet);

    const container = document.createElement("div");
    container.id = componentID;
    container.classList.add("ab-bubble-container");

    const content = document.createElement("div");
    content.classList.add("ab-bubble-container__content");

    const logoI = document.createElement("i");
    logoI.classList.add("ab-bubble-container__logo");
    const logoSVG = new DOMParser().parseFromString(logoIcon, "image/svg+xml").documentElement;
    logoI.appendChild(logoSVG);

    const textSpan = document.createElement("span");
    textSpan.classList.add("ab-bubble-container__text");
    textSpan.textContent = "Want to get rid of cookie pop-ups?";

    const button = document.createElement("button");
    button.addEventListener("click", onButtonClick);
    button.classList.add("ab-bubble-container__btn");
    button.textContent = "Here's how";

    content.appendChild(logoI);
    content.appendChild(textSpan);
    content.appendChild(button);

    container.appendChild(content);

    return container;
  }

  /**
   * Updates the position of a bubble relative to a banner element.
   *
   * @param {HTMLElement} message - The bubble pop-up element whose position is to be updated.
   * @param {HTMLElement} banner - The banner element used as a reference for positioning the button.
   */
  function updateBubblePosition(message, banner) {
    if (!message || !banner) {
      return;
    }

    const bannerRect = banner.getBoundingClientRect();
    const distanceFromRight = window.innerWidth - bannerRect.right;

    if (distanceFromRight > 200) {
      // make CTA appear on the right side of the banner if there enough space for it
      message.classList.remove("ab-bubble-container--top");
      message.classList.add("ab-bubble-container--side");
      message.style.left = `${bannerRect.right + 24}px`;
      message.style.right = "auto";
      message.style.bottom = "120px";
      message.removeAttribute("hidden");
    } else if (bannerRect.top > 200) {
      // default position on the top of the banner
      message.classList.remove("ab-bubble-container--side");
      message.classList.add("ab-bubble-container--top");
      message.style.bottom = `${window.innerHeight - bannerRect.top + 24}px`;
      message.style.right = "2.75vw";
      message.style.left = "auto";

      // If the banner is not aligned to the right edge, adjust the bubble position
      if (distanceFromRight !== 0) {
        // Convert 2.75vw to pixels
        const vwOffset = (window.innerWidth * 2.75) / 100;
        // Add 2.75vw to the distance from right
        message.style.right = `${distanceFromRight + vwOffset}px`;
      }
      message.removeAttribute("hidden");
    } else {
      // no space for a bubble pop-up
      message.setAttribute("hidden", true);
    }
  }

  /**
   * Called when a user clicks our button. Will send an event and open a new tab.
   */
  function onButtonClick() {
    document.dispatchEvent(new CustomEvent(buttonClickedEventName));
    window.open(targetURL);
  }

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
    if (!success) {
      return;
    }

    // handle injection on UI shown
    if (tcData.eventStatus === "cmpuishown") {
      document.dispatchEvent(new CustomEvent(cmpMessageDetectedEventName));
      setTimeout(() => {
        injectComponent();
      }, injectionDelay);
    }

    // Handle user choice events
    if (tcData.eventStatus === "useractioncomplete" || tcData.eventStatus === "tcloaded") {
      // remove all injected elements
      const button = document.getElementById(componentID);
      if (button) {
        const banner = document.getElementById("onetrust-banner-sdk");
        window.removeEventListener("resize", () => {
          updateBubblePosition(button, banner);
        });
        button.remove();
      }
      const styleSheet = document.getElementById(componentStyleSheetID);
      if (styleSheet) {
        styleSheet.remove();
      }

      // remove event listener only after user completed interaction with the consent banner
      if (window[tcfKeyName]) {
        window[tcfKeyName]("removeEventListener", 2, () => {}, tcData.listenerId);
      }
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
