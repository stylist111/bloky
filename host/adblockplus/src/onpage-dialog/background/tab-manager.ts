/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  createSafeOriginUrl,
  dismissCommand,
  getBehavior,
  getCommand,
  getContent,
  isCommandExpired
} from "@eyeo-fragments/in-product-messaging/background";

import { type Tabs } from "webextension-polyfill";

import {
  type MessageSender,
  addTrustedMessageTypes,
  port
} from "../../core/messaging/background";
import { TabSessionStorage } from "../../../adblockpluschrome/lib/storage/tab-session";
import { EventEmitter } from "../../../adblockpluschrome/lib/events";
import { getLocaleInfo } from "../../i18n/background";
import { info } from "../../info/background";
import * as logger from "../../logger/background";
import { type Message, isMessage } from "~/core/messaging/shared";
import { type TabRemovedEventData } from "../../polyfills/background";
import { type HideMessage, type StartInfo, isPingMessage } from "../shared";
import {
  isCookieBannerDialog,
  isDialog,
  isDialogBehavior,
  isDialogContent
} from "./dialog";
import { type Dialog } from "./dialog.types";
import { setDialogCommandHandler } from "./middleware";
import { clearStats, getStats, setStats } from "./stats";
import {
  coolDownPeriodKey,
  lastShownKey,
  ShowOnpageDialogResult
} from "./tab-manager.types";
import {
  shouldBeDismissed,
  shouldBeShown,
  start as setupTimings
} from "./timing";
import { isTabPage, pageEmitter } from "~/core/pages/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { Timing } from "./timing.types";
import { getPremiumSubscriptionsState } from "~/premium-subscriptions/background";
import { COOKIES_PREMIUM_SUBSCRIPTION_TYPE } from "~/premium-subscriptions/shared";

/**
 * Tab-specific session storage for dialogs
 */
const assignedDialogs = new TabSessionStorage("onpage-dialog:dialogs");
/**
 * Dialog event emitter
 */
export const eventEmitter = new EventEmitter();
/**
 * Queue of dialogs that haven't been assigned to a tab yet
 * Keys are dialog IDs
 */
export const unassignedDialogs = new Map<string, Dialog>();

/**
 * Pages where a cookie banner has been detected
 */
export const pagesWithCookieBanner = new Set<number>();

/**
 * Server logger instance for events related to the on-page dialog feature
 */
const serverLogger = new ewe.telemetry.ServerLogger("onpage_dialog");

/**
 * Compares two dialogs to see which has the higher priority.
 *
 * @param dialogA The first dialog
 * @param dialogB The second dialog
 * @returns -1 if dialogA has a higher priority, 1 if dialogB does, 0 if both are equal
 */
export function compareDialogsByPriority(
  dialogA: Dialog,
  dialogB: Dialog
): number {
  if (dialogA.behavior.priority > dialogB.behavior.priority) {
    return -1;
  }

  if (dialogA.behavior.priority < dialogB.behavior.priority) {
    return 1;
  }

  const lowPriorityFallbackValue = "z"; // "z" is the lowest alphanumeric value
  const ipmIdA = dialogA.ipmId ?? lowPriorityFallbackValue;
  const ipmIdB = dialogB.ipmId ?? lowPriorityFallbackValue;

  if (ipmIdA < ipmIdB) {
    return -1;
  }
  if (ipmIdA > ipmIdB) {
    return 1;
  }

  return 0;
}

/**
 * Checks whether the global dialog cool down period is still ongoing.
 *
 * @returns true if the cool down period is till ongoing, false if not
 */
export async function isCoolDownPeriodOngoing(): Promise<boolean> {
  await Prefs.untilLoaded;
  return Prefs.get(lastShownKey) + Prefs.get(coolDownPeriodKey) > Date.now();
}

/**
 * Removes the frame containing the on-page dialog
 *
 * @param tabId - Tab ID
 */
async function removeDialogFrame(tabId: number): Promise<void> {
  const message: HideMessage = { type: "onpage-dialog.hide" };
  await sendMessage(tabId, message);
}

/**
 * Removes on-page dialog
 *
 * @param tabId - Tab ID
 * @param [keepStorage=false] - Indicates whether the dialog should be kept
 *   in storage, so that it can be showed again later
 */
async function removeDialog(
  tabId: number,
  keepStorage: boolean = false
): Promise<void> {
  logger.debug("[onpage-dialog]: Remove dialog");

  const dialog = await assignedDialogs.get(tabId);
  if (!isDialog(dialog)) {
    return;
  }

  try {
    await removeDialogFrame(tabId);
    await assignedDialogs.delete(tabId);
  } catch (ex) {
    // Ignore if tab has already been removed
  }

  if (keepStorage) {
    return;
  }

  // Determine whether dialog should remain active
  const stats = getStats(dialog.id);
  if (!shouldBeDismissed(dialog, stats)) {
    logger.debug("[onpage-dialog]: Keep dialog active");
    return;
  }

  dismissDialog(dialog);
  clearStats(dialog.id);
}

/**
 * Dismisses on-page dialog
 *
 * @param dialog - Dialog information
 */
function dismissDialog(dialog: Dialog): void {
  logger.debug("[onpage-dialog]: Dismiss dialog");
  unassignedDialogs.delete(dialog.id);

  if (typeof dialog.ipmId === "string") {
    dismissCommand(dialog.ipmId);
  }
}

/**
 * Forwards message from a tab to its top-level frame
 *
 * @param message - Message
 * @param sender - Message sender
 *
 * @returns message response
 */
async function forwardMessage(
  message: unknown,
  sender: MessageSender
): Promise<unknown> {
  if (!isMessage(message) || typeof sender.tab?.id === "undefined") {
    return;
  }

  return await sendMessage(sender.tab.id, message);
}

/**
 * Handles "onpage-dialog.close" messages
 *
 * @param message - Message
 * @param sender - Message sender
 */
async function handleCloseMessage(
  message: Message,
  sender: MessageSender
): Promise<void> {
  if (typeof sender.tab?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.tab.id);
  if (!isDialog(dialog)) {
    return;
  }

  void removeDialog(sender.tab.id);
  serverLogger.behavior("dialog_closed", dialog.ipmId ?? "", dialog.ipmId);
}

/**
 * Handles "onpage-dialog.continue" messages
 *
 * @param message - Message
 * @param sender - Message sender
 */
async function handleContinueMessage(
  message: Message,
  sender: MessageSender
): Promise<void> {
  if (typeof sender.tab?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.tab.id);
  if (!isDialog(dialog)) {
    return;
  }

  const safeTargetUrl = createSafeOriginUrl(dialog.behavior.target);
  if (safeTargetUrl === null) {
    return;
  }

  void browser.tabs.create({ url: safeTargetUrl });

  void removeDialog(sender.tab.id);
  serverLogger.behavior(
    "dialog_button_clicked",
    dialog.ipmId ?? "",
    dialog.ipmId
  );
}

/**
 * Handles IPM commands
 *
 * @param ipmId - IPM ID
 */
async function handleDialogCommand(ipmId: string): Promise<void> {
  if (typeof ipmId !== "string") {
    return;
  }

  const behavior = getBehavior(ipmId);
  if (!isDialogBehavior(behavior)) {
    return;
  }

  const content = getContent(ipmId);
  if (!isDialogContent(content)) {
    return;
  }

  const dialog: Dialog = { behavior, content, id: ipmId, ipmId };
  unassignedDialogs.set(dialog.id, dialog);

  serverLogger.behavior("command_ready", ipmId, ipmId);
}

/**
 * Handles "onpage-dialog.get" messages
 *
 * @param message - Message
 * @param sender - Message sender
 *
 * @returns on-page dialog initialization information
 */
async function handleGetMessage(
  message: Message,
  sender: MessageSender
): Promise<StartInfo | null> {
  if (typeof sender.tab?.id === "undefined") {
    return null;
  }

  const dialog = await assignedDialogs.get(sender.tab.id);
  if (!isDialog(dialog)) {
    return null;
  }

  return {
    content: dialog.content,
    localeInfo: getLocaleInfo()
  };
}

/**
 * Handles "onpage-dialog.ping" messages
 *
 * @param message - Message
 * @param  sender - Message sender
 */
async function handlePingMessage(
  message: Message,
  sender: MessageSender
): Promise<void> {
  if (!isPingMessage(message) || typeof sender.tab?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.tab.id);
  if (!isDialog(dialog)) {
    return;
  }

  // Check whether on-page dialog has been shown long enough already
  if (
    dialog.behavior.displayDuration === 0 ||
    message.displayDuration < dialog.behavior.displayDuration
  ) {
    return;
  }

  void removeDialog(sender.tab.id);
  serverLogger.behavior("dialog_ignored", dialog.ipmId ?? "", dialog.ipmId);
}

/**
 * Handles "tab-removed" tab session storage event
 *
 * @param data - Event data
 */
function handleTabRemovedEvent(data: TabRemovedEventData): void {
  const { tabId, value: dialog } = data;

  if (!isDialog(dialog)) {
    return;
  }

  void removeDialog(tabId);
  serverLogger.behavior("dialog_ignored", dialog.ipmId ?? "", dialog.ipmId);
}

/**
 * Iterate over a list of dialogs and try until a dialog can be shown,
 * or the list is empty.
 *
 * @param dialogs - the list of dialogs where a dialog should be shown
 * @param tab - the page tab where we will try to show a dialog
 * @param dismissDialogFn - a callback function that will dissmiss dialogs
 */
export async function showDialogFromList(
  dialogs: Dialog[],
  tab: Tabs.Tab,
  dismissDialogFn = dismissDialog
): Promise<void> {
  if (!tab.id) {
    return;
  }

  for (const dialog of dialogs) {
    // Ignore and dismiss command if it has expired
    if (typeof dialog.ipmId === "string") {
      const command = getCommand(dialog.ipmId);
      // If the command disappears from storage, it means it's expired when
      // running the new fragment. With the legacy fragment, this shouldn't
      // happen, but we can't continue anyways.
      if (command && isCommandExpired(command)) {
        logger.error("[onpage-dialog]: Command has expired.");
        dismissDialogFn(dialog);
        continue;
      }
    }

    // Ignore and dismiss 'cookie banner' OPDs if user
    // has the cookie premium filter list activated
    if (isCookieBannerDialog(dialog)) {
      const premiumSubscriptionsState = await getPremiumSubscriptionsState();
      const isCookieSubscriptionActive =
        premiumSubscriptionsState[COOKIES_PREMIUM_SUBSCRIPTION_TYPE];

      if (isCookieSubscriptionActive) {
        logger.debug(
          "[onpage-dialog]: Dismiss 'cookie banner' OPD due to Premium cookie subscription active"
        );
        dismissDialogFn(dialog);
        continue;
      }
    }

    const result = await showOnpageDialog(tab.id, tab, dialog);
    if (result === ShowOnpageDialogResult.rejected) {
      dismissDialogFn(dialog);
    }
  }
}

/**
 * Handles "loaded" page events
 *
 * @param page - Page that finished loading
 */
async function handlePageLoadedEvent(page: unknown): Promise<void> {
  if (!isTabPage(page)) {
    return;
  }

  if (!page.id) {
    return;
  }

  // Clean any leftover dialog from pages being loaded in unusual ways,
  // e.g. pages that simulate navigation by changing browser session history
  try {
    if (await assignedDialogs.has(page.id)) {
      // keep dialogs whose communication with the extension is not lost
      // and ignore handling any other command in the extension
      logger.debug("[onpage-dialog]: Tab already contains dialog");
      return;
    }
    // remove dialogs whose communication is lost
    await removeDialogFrame(page.id);
  } catch (ex) {
    // Ignore if there's no dialog to remove
  }

  if (unassignedDialogs.size === 0) {
    logger.debug("[onpage-dialog]: No command");
    return;
  }

  let tab = null;
  try {
    tab = await browser.tabs.get(page.id);
  } catch (ex) {
    return;
  }

  if (
    tab.incognito ||
    typeof tab.url !== "string" ||
    !/^https?:/.test(tab.url)
  ) {
    return;
  }

  // Sort the waiting dialogs by priority.
  const dialogs = Array.from(unassignedDialogs.values()).sort(
    compareDialogsByPriority
  );

  void showDialogFromList(dialogs, tab);
}

/**
 * Sends message to the given tab
 *
 * @param tabId - Tab ID
 * @param message - Message
 *
 * @returns message response
 */
async function sendMessage(tabId: number, message: Message): Promise<unknown> {
  return await browser.tabs.sendMessage(tabId, message, { frameId: 0 });
}

/**
 * Indicates whether user wants to ignore dialogs
 *
 * @returns whether dialogs should be ignored
 */
async function shouldBeIgnored(): Promise<boolean> {
  const ignoredCategories = await ewe.notifications.getIgnoredCategories();
  return ignoredCategories.includes("*");
}

/**
 * Show dialog on given tab
 *
 * @param tabId - ID of tab in which to show the dialog
 * @param tab - Tab in which to show the dialog
 * @param dialog - Dialog information
 *
 * @returns result of attempting to show on-page dialog
 */
export async function showOnpageDialog(
  tabId: number,
  tab: Tabs.Tab,
  dialog: Dialog
): Promise<ShowOnpageDialogResult> {
  // Ignore and dismiss dialog if user opted-out of notifications
  if (await shouldBeIgnored()) {
    logger.debug("[onpage-dialog]: User ignores notifications");
    return ShowOnpageDialogResult.rejected;
  }

  // Check if the global dialog cool down period is still ongoing.
  // Dialogs with "immediate" timing (e.g. the local YT dialog) ignore
  // the cool down.
  if (
    dialog.behavior.timing !== Timing.immediate &&
    (await isCoolDownPeriodOngoing())
  ) {
    logger.debug("[onpage-dialog]: Cool down period still ongoing");
    return ShowOnpageDialogResult.ignored;
  }

  const stats = getStats(dialog.id);
  const shouldDialogBeDismissed = shouldBeDismissed(dialog, stats);
  const shouldDialogBeShown = await shouldBeShown(tab, dialog, stats);

  // Reject commands that should be dismissed
  if (shouldDialogBeDismissed) {
    logger.debug("[onpage-dialog]: Reject dialog");
    return ShowOnpageDialogResult.rejected;
  }

  // Ignore and dismiss dialog that should be shown in a given tab,
  // if such tab already contains a dialog
  if (shouldDialogBeShown && (await assignedDialogs.has(tabId))) {
    logger.debug("[onpage-dialog]: Tab already contains dialog");
    return ShowOnpageDialogResult.rejected;
  }

  // Ignore if on-page dialog should not be shown for this tab
  if (!shouldDialogBeShown) {
    logger.debug("[onpage-dialog]: Don't show");
    return ShowOnpageDialogResult.ignored;
  }

  // Ignore cookie banner dialog if no banner has been detected in the page
  if (isCookieBannerDialog(dialog) && !pagesWithCookieBanner.has(tabId)) {
    logger.debug("[onpage-dialog]: No cookie banner detected on page");
    return ShowOnpageDialogResult.ignored;
  }

  logger.debug("[onpage-dialog]: Show dialog");
  await assignedDialogs.set(tabId, dialog);

  // Sometimes dialog fails to be asssigned to the page,
  // in that case we should ignore it so it can be retried
  const assignedDialogOnPage = await assignedDialogs.get(tabId);
  if (!isDialog(assignedDialogOnPage)) {
    logger.debug("[onpage-dialog]: Failed to be assigned to the page ", tabId);
    return ShowOnpageDialogResult.ignored;
  }

  const now = Date.now();
  setStats(dialog.id, {
    displayCount: stats.displayCount + 1,
    lastDisplayTime: now
  });
  await Prefs.set(lastShownKey, now);

  try {
    await injectDialog(tabId);
  } catch (ex) {
    logger.reportAndLogError(ex, "[onpage-dialog] Injection of dialog failed");
    return ShowOnpageDialogResult.error;
  }

  serverLogger.behavior("dialog_injected", dialog.ipmId ?? "", dialog.ipmId);
  return ShowOnpageDialogResult.shown;
}

/**
 * Injects the necessary user styles into the tab and tells the tab
 * to display the on-page dialog
 *
 * @param tabId - ID of tab in which to show the dialog
 */
async function injectDialog(tabId: number): Promise<void> {
  // We only inject styles into the page when we actually need them. Otherwise
  // websites may use them to detect the presence of the extension. For content
  // scripts this is not a problem, because those only interact with the web
  // page when we tell them to. Therefore we inject them via manifest.json.
  logger.debug("[onpage-dialog]: Injecting dialog");
  if (browser.scripting) {
    await browser.scripting.insertCSS({
      files: ["skin/onpage-dialog.css"],
      origin: "USER",
      target: { tabId }
    });
  } else {
    await browser.tabs.insertCSS(tabId, {
      cssOrigin: "user",
      file: "/skin/onpage-dialog.css"
    });
  }

  await browser.tabs.sendMessage(tabId, {
    type: "onpage-dialog.show",
    platform: info.platform
  });
}

/**
 * Handles "cookie-banner.detected" messages
 *
 * @param message - Message
 * @param sender - Message sender
 * @param processCookieBannerDialogs - Callback to process cookie banner dialogs
 */
export function handleCookieBannerDetected(
  message: Message,
  sender: MessageSender,
  processCookieBannerDialogs = showDialogFromList
): void {
  logger.debug("[onpage-dialog]: Cookie banner detected");
  const { tab } = sender;

  if (!tab) {
    return;
  }

  if (!tab.id) {
    return;
  }

  pagesWithCookieBanner.add(tab.id);

  // Sort the waiting dialogs by priority.
  let dialogs = Array.from(unassignedDialogs.values()).sort(
    compareDialogsByPriority
  );
  // Filter out cookie banner dialogs
  dialogs = dialogs.filter((dialog) => isCookieBannerDialog(dialog));

  void processCookieBannerDialogs(dialogs, tab);
}

/**
 * Clears active commands
 */
async function clearCommands(): Promise<void> {
  unassignedDialogs.clear();

  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (typeof tab.id === "undefined") {
      continue;
    }

    await removeDialog(tab.id, true);
  }
}

/**
 * Initializes on-page manager
 */
export async function start(): Promise<void> {
  await setupTimings();

  // Handle messages from content scripts
  port.on("onpage-dialog.close", handleCloseMessage);
  port.on("onpage-dialog.continue", handleContinueMessage);
  port.on("onpage-dialog.get", handleGetMessage);
  port.on("onpage-dialog.ping", handlePingMessage);
  port.on("onpage-dialog.hide", forwardMessage);
  port.on("onpage-dialog.resize", forwardMessage);
  port.on("cookie-banner.detected", handleCookieBannerDetected);

  addTrustedMessageTypes(null, [
    "onpage-dialog.continue",
    "onpage-dialog.close",
    "onpage-dialog.get",
    "onpage-dialog.ping",
    "onpage-dialog.hide",
    "onpage-dialog.resize",
    "cookie-banner.detected"
  ]);

  // Dismiss dialog when tab used for storing session data gets closed
  assignedDialogs.on("tab-removed", handleTabRemovedEvent);

  // Dismiss detection of cookie banner when tab gets closed
  pageEmitter.on("removed", (tabId: number) => {
    if (pagesWithCookieBanner.has(tabId)) {
      pagesWithCookieBanner.delete(tabId);
    }
  });

  // Handle commands
  pageEmitter.on("loaded", handlePageLoadedEvent);
  /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
  setDialogCommandHandler(handleDialogCommand, clearCommands);
}
