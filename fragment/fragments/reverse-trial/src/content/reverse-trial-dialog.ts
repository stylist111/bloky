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
  DIALOG_SHOWN_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  DIALOG_MARKER_ATTRIBUTE,
  YT_MASTHEAD_TIMEOUT_MS,
} from "../shared/constants.js";
import {
  DialogAction,
  type DialogPayload,
  type BodyLine,
} from "../shared/types.js";

/**
 * Sends a dialog-action message to the service worker. The `action`
 * field is either a configured i18n key (for ctaButton / links) or a
 * built-in uppercase default (`CLOSE`, `AUTO_DISMISS`). Fire-and-forget
 * — the service worker owns the response (step advancement, broadcast).
 */
function sendDialogAction(touchPointStep: number, action: string): void {
  void browser.runtime.sendMessage({
    type: DIALOG_ACTION_MESSAGE_TYPE,
    touchPointStep,
    action,
  });
}

/**
 * Notifies the service worker that the dialog was actually rendered on the
 * page. The service worker emits the `dialog_shown` impression telemetry in
 * response, so it's only counted when the dialog truly appeared — not when a
 * co-installed sibling extension won the shared-DOM render race.
 */
function sendDialogShown(touchPointStep: number): void {
  void browser.runtime.sendMessage({
    type: DIALOG_SHOWN_MESSAGE_TYPE,
    touchPointStep,
  });
}

/**
 * Resolves with `true` if the user has a YouTube Premium subscription.
 *
 * Checks the `logo-type` attribute on YouTube's `#masthead` element
 * because that attribute flips to `YOUTUBE_PREMIUM_LOGO` only for
 * Premium accounts — other detection signals (cookies, DOM markers) are
 * either unreliable or flag the extension to content-blocker detection.
 *
 * Observes the DOM for the masthead's arrival since this content script
 * runs at `document_start`. Gives up after `YT_MASTHEAD_TIMEOUT_MS` and
 * assumes non-Premium — YouTube users with the masthead never rendered
 * within that window are almost certainly not Premium.
 */
async function detectYouTubePremium(
  timeoutMs = YT_MASTHEAD_TIMEOUT_MS,
): Promise<boolean> {
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
 * Checks whether YouTube is rendering in dark mode. Inspects two
 * markers — the `dark` attribute on `documentElement` (set early during
 * page load) and `ytd-app[dark]` (set once the React tree mounts) — so
 * the check is accurate both during initial render and after hydration.
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
    user-select: none;
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
    user-select: none;
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

  em, u {
    color: inherit;
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

  em, u {
    color: inherit;
  }
`;

/**
 * Parses text for `<strong>`, `<em>`, and `<u>` markers and appends text
 * nodes / elements. Tags are flat — no nesting is supported.
 *
 * Uses `document.createElement` + `textContent` throughout so no raw HTML
 * is ever inserted; the tag syntax is parsed but the tag text itself
 * never reaches the DOM.
 */
function appendRichText(parent: HTMLElement, text: string): void {
  const parts = text.split(/(<(?:strong|em|u)>.*?<\/(?:strong|em|u)>)/g);
  for (const part of parts) {
    const match = /^<(strong|em|u)>(.*?)<\/\1>$/.exec(part);
    if (match) {
      const el = document.createElement(match[1]);
      el.textContent = match[2];
      parent.appendChild(el);
    } else if (part) {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

/**
 * Renders a single body line as a styled paragraph.
 *
 * Text is already localized and variable-substituted by the service
 * worker — the content script has no access to `browser.i18n` for OPD
 * copy and does not do any substitution of its own. The `style` field
 * picks one of three class-based treatments defined in CSS.
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
 * Removes the dialog from the DOM and sets `dialogRemoved = true`
 * permanently. The flag is sticky (never reset) so a late-arriving
 * `renderDialog` from the service worker — e.g. after a broadcast
 * dismiss raced this tab's own click handler — does not re-render.
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
 * Stopping and restarting on hover / focus gives users with assistive
 * tech time to read the dialog instead of having it disappear.
 */
function startAutoDismissTimer(): void {
  if (autoDismissMs === null) {
    return;
  }

  const touchPointStep = currentTouchPointStep;
  autoDismissTimer = setTimeout(() => {
    removeDialog();
    if (touchPointStep !== null) {
      sendDialogAction(touchPointStep, DialogAction.AUTO_DISMISS);
    }
  }, autoDismissMs);
}

/**
 * Cancels the pending auto-dismiss without removing the dialog. Called
 * on `pointerenter` / `focusin` so the dialog stays visible while the
 * user is engaging with it.
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
 * The content script is deliberately action-type unaware: for every click
 * it sends the element's `key` (or a built-in uppercase default) back to
 * the service worker as the `action`. The service worker resolves the key
 * to its configured `StepAction` and owns step advancement / dismissal.
 *
 * @param payload - The dialog content and configuration from the service worker
 * @returns The host element containing the Shadow DOM dialog
 */
function buildDialog(payload: DialogPayload): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute(DIALOG_MARKER_ATTRIBUTE, "");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent =
    DIALOG_STYLES + (isDarkMode() ? DARK_DIALOG_STYLES : LIGHT_DIALOG_STYLES);
  shadow.appendChild(style);

  const dialog = document.createElement("div");
  dialog.id = "dialog";

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

  if (payload.showCloseButton) {
    const closeBtn = document.createElement("button");
    closeBtn.id = "close-btn";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => {
      sendDialogAction(payload.touchPointStep, DialogAction.CLOSE);
      removeDialog();
    });
    dialog.appendChild(closeBtn);
  }

  for (const line of payload.body) {
    dialog.appendChild(renderBodyLine(line));
  }

  if (payload.ctaButton) {
    const ctaBtn = document.createElement("button");
    ctaBtn.id = "cta-btn";
    ctaBtn.textContent = payload.ctaButton.text;
    const ctaButton = payload.ctaButton;
    ctaBtn.addEventListener("click", () => {
      if (ctaButton.url) {
        window.open(ctaButton.url, "_blank");
      } else {
        removeDialog();
      }
      sendDialogAction(payload.touchPointStep, ctaButton.key);
    });
    dialog.appendChild(ctaBtn);
  }

  const links = payload.links ?? [];
  if (links.length > 0) {
    const linksRow = document.createElement("div");
    linksRow.id = "links-row";
    if (!payload.ctaButton) {
      linksRow.classList.add("no-cta");
    }

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const el = document.createElement("a");
      el.textContent = link.text;
      if (link.url) {
        el.href = link.url;
        el.target = "_blank";
      } else {
        el.href = "#";
      }

      el.addEventListener("click", (e) => {
        if (!link.url) {
          e.preventDefault();
          removeDialog();
        }
        sendDialogAction(payload.touchPointStep, link.key);
      });

      linksRow.appendChild(el);

      if (i < links.length - 1) {
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
  // Cross-extension guard: if a sibling eyeo extension (AdBlock/ABP,
  // both shipping this fragment) already rendered an OPD on this page,
  // don't add a second one. Read-only check with no `await` before the
  // append below, so whichever content script gets here first wins the
  // race and the other bails. Removal stays keyed to `dialogContainer`
  // (never this marker), so a bailing extension never touches the
  // sibling's dialog.
  if (document.querySelector(`[${DIALOG_MARKER_ATTRIBUTE}]`)) {
    return;
  }
  dialogContainer = buildDialog(payload);
  currentTouchPointStep = payload.touchPointStep;
  document.body.appendChild(dialogContainer);
  sendDialogShown(payload.touchPointStep);

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

  // Must not be async: returning `undefined` (not a Promise) for
  // unhandled message types is how the listener signals "I did not
  // handle this message", so other listeners get their turn. Making
  // this function async would always return a Promise and break that.
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  browser.runtime.onMessage.addListener(function dismissListener(message) {
    if ((message as { type?: string })?.type !== DISMISS_DIALOG_MESSAGE_TYPE) {
      return undefined;
    }
    removeDialog();
    browser.runtime.onMessage.removeListener(dismissListener);
    return Promise.resolve();
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
