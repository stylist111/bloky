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

/* For ESLint: List any global identifiers used in this file below */
/* global setLangAndDirAttributes */

import * as browser from "webextension-polyfill";
import DOMPurify from "dompurify";
import latoRegular from "@fontsource/lato/files/lato-latin-400-normal.woff?uri";
import latoExtRegular from "@fontsource/lato/files/lato-latin-ext-400-normal.woff?uri";
import latoExtItalic from "@fontsource/lato/files/lato-latin-ext-400-italic.woff?uri";
import latoItalic from "@fontsource/lato/files/lato-latin-400-italic.woff?uri";
import latoExtBoldItalic from "@fontsource/lato/files/lato-latin-ext-700-italic.woff?uri";
import latoBoldItalic from "@fontsource/lato/files/lato-latin-700-italic.woff?uri";
import latoExtBold from "@fontsource/lato/files/lato-latin-ext-700-normal.woff?uri";
import latoBold from "@fontsource/lato/files/lato-latin-700-normal.woff?uri";
import materialIconsRegular from "@eyeo/material-icons/src/MaterialIcons-Regular.woff2?uri";

import dialogLogo from "../../../icons/adblock-20.svg?uri";

import dialogCss from "./dialog.css?text";
import dialogHtml from "./dialog.html?text";

import { isMessage } from "../../polyfills/shared/index";
import { StartInfo } from "../shared/index";
import * as api from "../../../adblockplusui/js/api/index";
import { getDialogContainer } from "./dialog-container";

/**
 * List of bundled fonts to load into the web page
 *
 */
const fontsToLoad = [
  {
    src: latoRegular,
    style: "normal",
    weight: "normal",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    src: latoExtRegular,
    style: "normal",
    weight: "normal",
    unicodeRange:
      "U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
  {
    src: latoExtItalic,
    style: "italic",
    weight: "normal",
    unicodeRange:
      "U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
  {
    src: latoItalic,
    style: "italic",
    weight: "normal",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    src: latoExtBoldItalic,
    style: "italic",
    weight: "bold",
    unicodeRange:
      "U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
  {
    src: latoBoldItalic,
    style: "italic",
    weight: "bold",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    src: latoExtBold,
    style: "normal",
    weight: "bold",
    unicodeRange:
      "U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
  {
    src: latoBold,
    style: "normal",
    weight: "bold",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
];

/**
 * The ID of the top most parent element of the dialog
 *
 */
const divID = "__ABoverlay";
/**
 * The default top position of the dialog (in pixels)
 *
 */
const defaultTopPosition = 37;
/**
 * A reference to the interval ID used to periodically ping the background page or service worker
 *
 */
let intervalId: number;

/**
 * Removes the dialog from the page, if it is shown
 */
const removeDialog = function () {
  const el = document.getElementById(divID);
  if (el) {
    el.parentNode?.removeChild(el);
  }
  if (intervalId) {
    clearInterval(intervalId);
  }
};

/**
 * Loads the CSS assets
 *
 * @param base - The shadow DOM base element
 */
function loadCss(base: ShadowRoot) {
  const styleElement = document.createElement("style");
  styleElement.textContent = dialogCss;
  base.appendChild(styleElement);
}

/**
 * Loads the font assets
 *
 * @param src - The URL to a font face file
 * @param style - The font style
 * @param weight -The font weight
 * @param unicodeRange - The specific range of characters to be used
 */
function loadLatoFont(src: string, style: string, weight: string, unicodeRange: string) {
  return new FontFace("Lato", `url("${src}")`, { style, weight, unicodeRange });
}

/**
 * Loads the font and CSS assets
 *
 * @param base - The shadow DOM base element
 *
 */
function loadResources(base: ShadowRoot) {
  loadCss(base);
  // load fonts programmatically
  // Referencing the fonts in CSS do not load the fonts properly (reason unknown)
  // but programmatically loading them performs reliably.
  fontsToLoad.forEach((fontData) => {
    const { src, style, weight, unicodeRange } = fontData;
    document.fonts.add(loadLatoFont(src, style, weight, unicodeRange));
  });
  document.fonts.add(
    new FontFace("Material Icons", `url("${materialIconsRegular}")`, {
      style: "normal",
      weight: "normal",
    }),
  );
}

/**
 * Sends messages to the background page
 *
 * @param message - Message
 *
 * @returns message response
 */
function sendMessage(message: unknown) {
  return browser.runtime.sendMessage(message);
}

/**
 * Create the dialog DIV and insert it into the DOM
 *
 * @param message - A message from the background page or service worker
 *
 */
const showDialog = async function (message: StartInfo) {
  const mainBody = document.body;
  if (!mainBody) {
    return;
  }
  // if the DIV already exists, don't add another one, just return
  if (document.getElementById(divID)) {
    return;
  }
  const { content } = message;
  const { title, body, button } = content;

  const dialogParentElement = document.createElement("div");
  dialogParentElement.id = divID;
  const dialogElement = DOMPurify.sanitize(dialogHtml, { RETURN_DOM_FRAGMENT: true });
  if (DOMPurify.removed && DOMPurify.removed.length > 0) {
    return;
  }
  const closeIcon = dialogElement.querySelector("#closeIcon");
  if (closeIcon instanceof HTMLElement) {
    closeIcon.onclick = function closedClicked(event: Event) {
      if (!event.isTrusted) {
        return;
      }
      sendMessage({ type: "onpage-dialog.close" });
    };
  }

  const adblockLogoElement = dialogElement.querySelector("#adblock-logo");
  if (adblockLogoElement instanceof HTMLImageElement) {
    adblockLogoElement.src = dialogLogo;
  }
  const titleTextElement = dialogElement.querySelector("#titleRow")!;
  titleTextElement.textContent = DOMPurify.sanitize(title);

  const bodyElement = dialogElement.querySelector<HTMLElement>("#bodySection");
  if (bodyElement instanceof HTMLElement) {
    for (const bodyText of body) {
      const paragraph = document.createElement("p");
      paragraph.classList.add("msgText");
      paragraph.textContent = DOMPurify.sanitize(bodyText);
      bodyElement.appendChild(paragraph);
    }
  }

  const btnContinue = dialogElement.querySelector("#continue");
  if (btnContinue instanceof HTMLElement) {
    if (button) {
      btnContinue.textContent = DOMPurify.sanitize(button);
      btnContinue.onclick = async function learnMoreClicked(event: Event) {
        if (!event.isTrusted) {
          return;
        }
        sendMessage({ type: "onpage-dialog.continue" });
      };
    } else {
      btnContinue.style.display = "none";
    }
  }

  const mode = navigator.webdriver ? "open" : "closed";
  const baseShadow = dialogParentElement.attachShadow({ mode });

  loadResources(baseShadow);
  setLangAndDirAttributes(dialogElement);

  const hostElement = baseShadow.host;
  if (hostElement instanceof HTMLElement) {
    hostElement.style.setProperty("--dialog-top-position", `${defaultTopPosition}px`);
  }

  baseShadow.appendChild(dialogElement);
  getDialogContainer().appendChild(dialogParentElement);
  // We're pinging the background page once per minute, so that it is aware
  // for how long the dialog has already been shown, in case it needs to
  // execute some actions with a delay
  let displayDuration = 0;
  intervalId = window.setInterval(() => {
    displayDuration += 1;
    sendMessage({ type: "onpage-dialog.ping", displayDuration });
  }, 60 * 1000);
  // We're pinging the background page immediately, so that it is aware
  // that the OPD was rendered
  sendMessage({ type: "onpage-dialog.ping", displayDuration });
};

/**
 * Handles messages from background page
 *
 * @param message - Message
 */
function handleMessage(message: unknown): true | Promise<unknown> | undefined {
  if (!isMessage(message)) {
    return;
  }

  switch (message.type) {
    case "onpage-dialog.hide":
      removeDialog();
      break;
    default:
  }
}

/**
 * Checks whether given candidate is start info
 *
 * @param candidate - Candidate
 * @returns whether given candidate is start info
 */
function isStartInfo(candidate: unknown): candidate is StartInfo {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    "content" in candidate &&
    "localeInfo" in candidate
  );
}

/**
 * Initializes on-page dialog
 */
async function start() {
  browser.runtime.onMessage.addListener(handleMessage);
  const startInfo = await sendMessage({ type: "onpage-dialog.get" });
  if (isStartInfo(startInfo)) {
    showDialog(startInfo);
  }
  // Clean up after extension unloads
  api.addDisconnectListener(() => {
    removeDialog();
    browser.runtime.onMessage.removeListener(handleMessage);
  });
}

start();
