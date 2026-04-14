/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";

import {
  GET_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  OPT_OUT_MESSAGE_TYPE,
  FEEDBACK_MESSAGE_TYPE,
} from "../shared/constants.js";
import type { DialogPayload, BodyLine } from "../shared/types.js";

/**
 * Waits for YouTube's `#masthead` element to appear in the DOM and
 * resolves with whether the user has a Premium subscription based on
 * the `logo-type` attribute. Disconnects the observer as soon as
 * `#masthead` is found, or after a timeout (assumes non-Premium).
 */
async function detectYouTubePremium(timeoutMs = 10000): Promise<boolean> {
  const masthead = document.querySelector("#masthead");
  if (masthead) {
    return masthead.getAttribute("logo-type") === "YOUTUBE_PREMIUM_LOGO";
  }

  return await new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector("#masthead");
      if (el) {
        observer.disconnect();
        resolve(el.getAttribute("logo-type") === "YOUTUBE_PREMIUM_LOGO");
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);
  });
}

/**
 * Checks if the dark mode is enabled
 */
function isDarkMode(): boolean {
  const docAttr = document.documentElement.getAttribute("dark");
  const ytdApp = document.querySelector("ytd-app");

  return docAttr !== null || ytdApp?.hasAttribute("dark") === true;
}

/**
 * Module-scoped reference to the dialog container element.
 * Used to prevent rendering duplicate dialogs and to remove
 * the dialog on user interaction.
 */
let dialogContainer: HTMLElement | null = null;

/**
 * True if the dialog was removed. Used to prevent opening the dialog if it was
 * dismissed on another tab prior to rendering it.
 */
let dialogRemoved = false;

/**
 * Handle for the auto-dismiss timer, if one is active. Cleared when the dialog
 * is removed by any means so the timer cannot fire after dismissal.
 */
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The auto-dismiss duration in milliseconds, stored so the timer can be
 * restarted after the cursor leaves the dialog.
 */
let autoDismissMs: number | null = null;

/**
 * Touch point step of the currently-rendered dialog, used when checking
 * with the service worker whether the dialog should still be shown.
 */
let currentTouchPointStep: number | null = null;

/**
 * True if the start function has been called before. Used to prevent having
 * multiple versions of the dialog rendering and callbacks running at the same
 * time, even if start is called twice.
 */
let startCalled = false;

const DIALOG_STYLES = `
  :host {
    position: fixed;
    top: 37px;
    right: 37px;
    z-index: 2147483647;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
  }

  #dialog {
    position: relative;
    border-radius: 12px;
    padding: 20px 24px;
    width: 300px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
  }

  #header {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
    gap: 8px;
  }

  #logo {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }

  #title {
    font-size: 14px;
    font-weight: 700;
    flex: 1;
    line-height: 1.3;
  }

  #close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  #cta-btn {
    display: block;
    width: auto;
    margin-top: 18px;
    margin-left: auto;
    margin-right: auto;
    padding: 10px 40px;
    background: #e53935;
    color: #fff;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    font-family: Arial, Helvetica, sans-serif;
  }

  #cta-btn:hover {
    background: #c62828;
  }

  #links-row {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    font-size: 13px;
  }

  #links-row.no-cta {
    margin-top: 32px;
  }

  #links-row a {
    text-decoration: none;
  }

  .links-separator {
    user-select: none;
  }

  .heading {
    font-size: 13px;
    font-weight: 600;
    margin: 12px 0 6px 0;
    text-align: left;
  }

  .list-item {
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    text-align: left;
    padding-left: 8px;
  }

  .check {
    color: #e53935;
    margin-right: 8px;
  }

  .body-text {
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 8px 0;
    padding: 0 8px;
  }
`;

const DARK_DIALOG_STYLES = `
  #dialog {
    background: #282828;
    color: #e0e0e0;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }

  #title {
    color: #fff;
  }

  #close-btn {
    color: #888;
  }

  #close-btn:hover {
    color: #fff;
  }

  #links-row a {
    color: #aaa;
  }

  #links-row a:hover {
    color: #e0e0e0;
  }

  .links-separator {
    color: #aaa;
  }

  .heading {
    color: #e0e0e0;
  }

  .list-item {
    color: #aaa;
  }

  .body-text {
    color: #aaa;
  }

  strong {
    color: #e0e0e0;
  }
`;

const LIGHT_DIALOG_STYLES = `
  #dialog {
    background: #ffffff;
    color: #333333;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  #title {
    color: #111111;
  }

  #close-btn {
    color: #777777;
  }

  #close-btn:hover {
    color: #111111;
  }

  #links-row a {
    color: #666666;
  }

  #links-row a:hover {
    color: #333333;
  }

  .links-separator {
    color: #666666;
  }

  .heading {
    color: #333333;
  }

  .list-item {
    color: #555555;
  }

  .body-text {
    color: #555555;
  }

  strong {
    color: #333333;
  }
`;

/**
 * Parses text for <strong>bold</strong> markers and appends text nodes / elements.
 * Follows the same convention as host/adblock i18n rendering.
 */
function appendRichText(parent: HTMLElement, text: string): void {
  const parts = text.split(/(<strong>.*?<\/strong>)/g);
  for (const part of parts) {
    const match = /^<strong>(.*?)<\/strong>$/.exec(part);
    if (match) {
      const strong = document.createElement("strong");
      strong.textContent = match[1];
      parent.appendChild(strong);
    } else if (part) {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

/**
 * Renders a single body line as an HTML element with a class-based style.
 *
 * Uses the `style` field to determine visual treatment. All text is
 * already resolved by the service worker.
 *
 * @param line - The body line with resolved text and style
 * @returns A styled HTML element
 */
function renderBodyLine(line: BodyLine): HTMLElement {
  if (line.style === "heading") {
    const el = document.createElement("p");
    el.className = "heading";
    el.textContent = line.text;
    return el;
  }

  if (line.style === "list-item") {
    const el = document.createElement("p");
    el.className = "list-item";

    const check = document.createElement("span");
    check.className = "check";
    check.textContent = "\u2713";

    el.appendChild(check);
    el.appendChild(document.createTextNode(line.text));
    return el;
  }

  const el = document.createElement("p");
  el.className = "body-text";
  appendRichText(el, line.text);
  return el;
}

/**
 * Removes the dialog container from the DOM and clears the module reference.
 */
function removeDialog(): void {
  dialogRemoved = true;
  currentTouchPointStep = null;
  autoDismissMs = null;

  if (autoDismissTimer !== null) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }

  if (dialogContainer) {
    dialogContainer.remove();
    dialogContainer = null;
  }
}

/**
 * Starts (or restarts) the auto-dismiss timer using the stored duration.
 * No-op if no duration is set.
 */
function startAutoDismissTimer(): void {
  if (autoDismissMs === null) {
    return;
  }

  const touchPointStep = currentTouchPointStep;
  autoDismissTimer = setTimeout(() => {
    removeDialog();
    void browser.runtime.sendMessage({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep,
      action: "auto-dismiss",
      silent: true,
    });
  }, autoDismissMs);
}

/**
 * Clears the auto-dismiss timer without removing the dialog.
 */
function stopAutoDismissTimer(): void {
  if (autoDismissTimer !== null) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
}

/**
 * Builds the dialog DOM tree inside a closed Shadow DOM, positioned in
 * the top-right corner to match existing OPD placement.
 *
 * The dialog includes:
 * - A header row with logo and title
 * - Body content (paragraphs, headings, list items)
 * - A CTA button that opens the target URL (if non-empty) and dismisses
 *
 * No element IDs are added outside the shadow root to the page to avoid
 * extension detection.
 *
 * @param payload - The dialog content and configuration from the service worker
 * @returns The host element containing the Shadow DOM dialog
 */
function buildDialog(payload: DialogPayload): HTMLElement {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent =
    DIALOG_STYLES + (isDarkMode() ? DARK_DIALOG_STYLES : LIGHT_DIALOG_STYLES);
  shadow.appendChild(style);

  const dialog = document.createElement("div");
  dialog.id = "dialog";

  // Header row: logo + title
  const header = document.createElement("div");
  header.id = "header";

  if (payload.logoUrl) {
    const logo = document.createElement("img");
    logo.id = "logo";
    logo.src = payload.logoUrl;
    header.appendChild(logo);
  }

  const title = document.createElement("span");
  title.id = "title";
  title.textContent = payload.title;
  header.appendChild(title);

  dialog.appendChild(header);

  const closeBtn = document.createElement("button");
  closeBtn.id = "close-btn";
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", () => {
    void browser.runtime.sendMessage({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: payload.touchPointStep,
      action: "close",
    });
    removeDialog();
  });
  dialog.appendChild(closeBtn);

  // Body content
  for (const line of payload.body) {
    dialog.appendChild(renderBodyLine(line));
  }

  // CTA button
  if (payload.button) {
    const ctaBtn = document.createElement("button");
    ctaBtn.id = "cta-btn";
    ctaBtn.textContent = payload.button;
    ctaBtn.addEventListener("click", () => {
      if (payload.target) {
        window.open(payload.target, "_blank");
      }
      void browser.runtime.sendMessage({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: payload.touchPointStep,
        action: payload.target ? "cta" : "close",
      });
      removeDialog();
    });
    dialog.appendChild(ctaBtn);
  }

  const linkDefs: HTMLElement[] = [];

  if (payload.learnMore) {
    const learnMore = document.createElement("a");
    learnMore.href = payload.learnMore.url;
    learnMore.target = "_blank";
    learnMore.textContent = payload.learnMore.text;
    learnMore.addEventListener("click", () => {
      void browser.runtime.sendMessage({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: payload.touchPointStep,
        action: "cta",
      });
    });
    linkDefs.push(learnMore);
  }

  if (payload.dismiss) {
    const dismiss = document.createElement("a");
    dismiss.href = "#";
    dismiss.textContent = payload.dismiss.text;
    dismiss.addEventListener("click", (e) => {
      e.preventDefault();
      void browser.runtime.sendMessage({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: payload.touchPointStep,
        action: "close",
      });
      removeDialog();
    });
    linkDefs.push(dismiss);
  }

  if (payload.optOut) {
    const optOut = document.createElement("a");
    optOut.href = "#";
    optOut.textContent = payload.optOut.text;
    optOut.addEventListener("click", (e) => {
      e.preventDefault();
      void browser.runtime.sendMessage({
        type: OPT_OUT_MESSAGE_TYPE,
        touchPointStep: payload.touchPointStep,
      });
      removeDialog();
    });
    linkDefs.push(optOut);
  }

  if (payload.feedback) {
    const feedback = document.createElement("a");
    feedback.href = payload.feedback.url;
    feedback.target = "_blank";
    feedback.textContent = payload.feedback.text;
    feedback.addEventListener("click", () => {
      void browser.runtime.sendMessage({
        type: FEEDBACK_MESSAGE_TYPE,
        touchPointStep: payload.touchPointStep,
      });
    });
    linkDefs.push(feedback);
  }

  if (linkDefs.length > 0) {
    const linksRow = document.createElement("div");
    linksRow.id = "links-row";
    if (!payload.button) {
      linksRow.classList.add("no-cta");
    }
    for (let i = 0; i < linkDefs.length; i++) {
      linksRow.appendChild(linkDefs[i]);
      if (i < linkDefs.length - 1) {
        const sep = document.createElement("span");
        sep.className = "links-separator";
        sep.textContent = "\u2022";
        linksRow.appendChild(sep);
      }
    }
    dialog.appendChild(linksRow);
  }

  shadow.appendChild(dialog);
  return host;
}

/**
 * Builds the dialog DOM and appends it to the document body.
 *
 * Guards against duplicate rendering — if a dialog is already present
 * on the page, this function is a no-op.
 *
 * @param payload - The resolved dialog content from the service worker
 */
function renderDialog(payload: DialogPayload): void {
  if (dialogContainer !== null || dialogRemoved) {
    return;
  }
  dialogContainer = buildDialog(payload);
  currentTouchPointStep = payload.touchPointStep;
  document.body.appendChild(dialogContainer);

  if (payload.autoDismissMs) {
    autoDismissMs = payload.autoDismissMs;
    startAutoDismissTimer();
    dialogContainer.addEventListener("pointerenter", stopAutoDismissTimer);
    dialogContainer.addEventListener("pointerleave", startAutoDismissTimer);
    dialogContainer.addEventListener("focusin", stopAutoDismissTimer);
    dialogContainer.addEventListener("focusout", startAutoDismissTimer);
  }
}

/**
 * Initializes the reverse trial content script.
 *
 * Sends a message to the service worker requesting dialog data. If a
 * {@link DialogPayload} is returned, renders the dialog in a closed Shadow DOM
 * attached to `document.body`. If the body is not yet available, defers
 * rendering until `DOMContentLoaded`.
 *
 * This function is idempotent — calling it multiple times on the same page
 * will not produce duplicate dialogs.
 */
export async function start(): Promise<void> {
  if (startCalled) {
    return;
  }
  startCalled = true;

  document.addEventListener("visibilitychange", () => {
    const needsCheck =
      document.visibilityState === "visible" &&
      dialogContainer !== null &&
      document.contains(dialogContainer);
    if (needsCheck) {
      void browser.runtime
        .sendMessage({
          type: GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
          touchPointStep: currentTouchPointStep,
        })
        .then((shouldStillShow) => {
          if (!shouldStillShow) {
            removeDialog();
          }
        });
    }
  });

  // Must not be async: returning undefined (not a Promise) for unhandled message
  // types is required to signal to the browser that this listener did not handle
  // those messages. Making it async would always return a Promise.
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  browser.runtime.onMessage.addListener(function dismissListener(message) {
    if ((message as { type?: string })?.type === DISMISS_DIALOG_MESSAGE_TYPE) {
      removeDialog();
      browser.runtime.onMessage.removeListener(dismissListener);
      return Promise.resolve();
    }
  });

  const ytPremium = await detectYouTubePremium();

  let payload: DialogPayload | null = null;
  try {
    payload = await browser.runtime.sendMessage({
      type: GET_DIALOG_MESSAGE_TYPE,
      ytPremium,
    });
  } catch {
    return;
  }

  if (!payload) {
    return;
  }

  renderDialog(payload);
}
