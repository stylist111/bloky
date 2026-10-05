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

import { Tabs } from "webextension-polyfill";
import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  createSafeOriginUrl,
  dismissCommand,
  getBehavior,
  getCommand,
  getContent,
  isCommandExpired,
} from "@eyeo-fragments/in-product-messaging/background";
import {
  getCampaignConfig,
  start as setupCampaignConfigs,
} from "@eyeo-fragments/opd-persistence-experiment/background";

import { Prefs } from "../../alias/prefs";
import { port } from "../../../adblockplusui/adblockpluschrome/lib/messaging/port";
import { TabSessionStorage } from "../../../adblockplusui/adblockpluschrome/lib/storage/tab-session";
import { EventEmitter } from "../../../adblockplusui/adblockpluschrome/lib/events";
import { getLocaleInfo } from "../../i18n/background";
import * as logger from "../../utilities/background";
import { MessageSender, TabRemovedEventData } from "../../polyfills/background";
import { getSettings } from "../../prefs/background/settings";
import { isCookieBannerDialog, isDialog, isDialogBehavior, isDialogContent } from "./dialog";
import { Message } from "../../polyfills/shared";
import { type HideMessage, type StartInfo, isPingMessage } from "../shared";
import { type Dialog } from "./dialog.types";
import { setDialogCommandHandler } from "./middleware";
import { clearStats, getStats, setStats } from "./stats";
import {
  ShowOnpageDialogResult,
  TabPage,
  coolDownPeriodKey,
  lastShownKey,
  type ImpressionEndReason,
  type InjectionFailureReason,
  type PersistentOpdEvent,
  type RemoveDialogOptions,
  type TerminationCause,
} from "./tab-manager.types";
import { shouldBeDismissed, shouldBeShown, start as setupTimings } from "./timing";

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
 * Server logger instance for events related to the on-page dialog UI
 */
const uiServerLogger = new ewe.telemetry.ServerLogger("onpage_dialog_ui");

/**
 * Server logger instance for impression-level events of campaigns that carry
 * per-campaign overrides
 */
const persistentOpdLogger = new ewe.telemetry.ServerLogger("persistent_opd");

/**
 * Emits an impression-level event for a campaign that carries per-campaign
 * overrides. Campaigns without overrides aren't part of the experiment, so they
 * emit nothing here and keep reporting through the on-page dialog UI events
 * only.
 *
 * @param event - Event name
 * @param dialog - Dialog information
 * @param displayCount - Impression the event belongs to
 * @param [reason] - How the impression ended, for the ignored event, or why
 *   injection failed, for the injection_failed event
 */
function logPersistentOpdEvent(
  event: PersistentOpdEvent,
  dialog: Dialog,
  displayCount: number,
  reason?: ImpressionEndReason | InjectionFailureReason,
): void {
  if (getCampaignConfig(dialog.ipmId) === null) {
    return;
  }

  const ipmId = dialog.ipmId ?? "";

  persistentOpdLogger.behavior(
    event,
    typeof reason === "string" ? { ipmId, displayCount, reason } : { ipmId, displayCount },
    dialog.ipmId,
  );
}

/**
 * Extracts a message from a thrown value, whether it's an `Error` or a
 * plain object with a `message` property.
 *
 * @param ex - Thrown value
 *
 * @returns the message, or an empty string if none could be found
 */
function getErrorMessage(ex: unknown): string {
  if (ex instanceof Error) {
    return ex.message;
  }

  if (
    typeof ex === "object" &&
    ex !== null &&
    "message" in ex &&
    typeof (ex as { message: unknown }).message === "string"
  ) {
    return (ex as { message: string }).message;
  }

  return "";
}

/**
 * Classifies an injection failure into one of a fixed set of reasons. The raw
 * error message is never reported, since it can contain the tab's URL.
 *
 * @param ex - Error thrown while injecting the dialog
 *
 * @returns classified failure reason
 */
function classifyInjectionFailure(ex: unknown): InjectionFailureReason {
  const message = getErrorMessage(ex);

  if (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  ) {
    return "no_receiver";
  }

  if (message.includes("No tab with id")) {
    return "no_tab";
  }

  return "other";
}

/**
 * Emits the dialog_display_duration telemetry event for a terminating dialog.
 * Inject time is read from stats.lastDisplayTime, which is set when the dialog
 * is assigned to a tab and persists across service worker suspension.
 *
 * @param dialog - Dialog that is terminating
 * @param cause - Reason for the termination
 */
function logDisplayDuration(dialog: Dialog, cause: TerminationCause): void {
  const { lastDisplayTime } = getStats(dialog.id);
  if (lastDisplayTime === 0) {
    return;
  }

  const durationMs = Date.now() - lastDisplayTime;

  uiServerLogger.debug("dialog_display_duration", {
    terminationCause: cause,
    durationMs,
    ipmId: dialog.ipmId,
  });
}

/**
 * Compares two dialogs to see which has the higher priority.
 *
 * @param dialogA The first dialog
 * @param dialogB The second dialog
 * @returns -1 if dialogA has a higher priority, 1 if dialogB does, 0 if both are equal
 */
export function compareDialogsByPriority(dialogA: Dialog, dialogB: Dialog): number {
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
 * Sends message to the given tab
 *
 * @param tabId - Tab ID
 * @param message - Message
 *
 * @returns message response
 */
function sendMessage(tabId: number, message: Message): Promise<any> {
  return browser.tabs.sendMessage(tabId, message, { frameId: 0 });
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
 * @param dialog - Dialog
 * @param [options] - Removal options
 * @param [options.keepStorage=false] - Indicates whether the dialog should be
 *   kept in storage, so that it can be showed again later
 * @param [options.userDismissed=false] - Indicates whether the user explicitly
 *   dismissed the dialog, by closing it or by interacting with its button
 */
async function removeDialog(
  tabId: number,
  dialog: Dialog,
  options: RemoveDialogOptions = {},
): Promise<void> {
  const { keepStorage = false, userDismissed = false } = options;

  logger.debug("[onpage-dialog]: Remove dialog");

  if (!isDialog(dialog)) {
    logger.debug("[onpage-dialog]: Remove dialog, no dialog found");
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

  const campaignConfig = getCampaignConfig(dialog.ipmId);
  const stats = getStats(dialog.id);

  // For campaigns that can be shown more than once, an explicit user action is
  // final: the dialog must not come back on a later page load
  if (userDismissed && campaignConfig !== null) {
    dismissDialog(dialog);
    clearStats(dialog.id);
    return;
  }

  // Determine whether dialog should remain active
  if (!shouldBeDismissed(dialog, stats, campaignConfig?.maxImpressions)) {
    logger.debug("[onpage-dialog]: Keep dialog active");
    return;
  }

  // The cap was reached without the user ever acting on the dialog, which is
  // what tells "we never reached them" apart from "they weren't interested".
  // The other retirement path is the dismissal check in showOnpageDialog, for
  // campaigns whose impressions ended by navigation instead.
  if (!userDismissed) {
    logPersistentOpdEvent("exhausted", dialog, stats.displayCount);
  }

  dismissDialog(dialog);
  clearStats(dialog.id);
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
 * Handles "onpage-dialog.close" messages
 *
 * @param message - Message
 * @param sender - Message sender
 */
async function handleCloseMessage(message: Message, sender: MessageSender): Promise<void> {
  if (typeof sender.page?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.page.id);
  if (!isDialog(dialog)) {
    return;
  }

  const { displayCount } = getStats(dialog.id);

  void removeDialog(sender.page.id, dialog, { userDismissed: true });
  uiServerLogger.behavior("dialog_closed", dialog.ipmId ?? "", dialog.ipmId);
  logPersistentOpdEvent("closed", dialog, displayCount);
}

/**
 * Handles "onpage-dialog.continue" messages
 *
 * @param message - Message
 * @param sender - Message sender
 */
async function handleContinueMessage(message: Message, sender: MessageSender): Promise<void> {
  if (typeof sender.page?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.page.id);
  if (!isDialog(dialog)) {
    return;
  }

  const safeTargetUrl = createSafeOriginUrl(dialog.behavior.target);
  if (safeTargetUrl === null) {
    return;
  }

  void browser.tabs.create({ url: safeTargetUrl });

  const { displayCount } = getStats(dialog.id);

  void removeDialog(sender.page.id, dialog, { userDismissed: true });
  uiServerLogger.behavior("dialog_button_clicked", dialog.ipmId ?? "", dialog.ipmId);
  logPersistentOpdEvent("clicked", dialog, displayCount);
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
  sender: MessageSender,
): Promise<StartInfo | null> {
  logger.debug("[onpage-dialog]: get");
  if (typeof sender.page?.id === "undefined") {
    return null;
  }

  const dialog = await assignedDialogs.get(sender.page.id);
  if (!isDialog(dialog)) {
    logger.debug("[onpage-dialog]: get, no dialog");
    return null;
  }

  return {
    content: dialog.content,
    localeInfo: getLocaleInfo(),
  };
}

/**
 * Handles "onpage-dialog.ping" messages
 *
 * @param message - Message
 * @param  sender - Message sender
 */
async function handlePingMessage(message: Message, sender: MessageSender): Promise<void> {
  if (!isPingMessage(message) || typeof sender.page?.id === "undefined") {
    return;
  }

  const dialog = await assignedDialogs.get(sender.page.id);
  if (!isDialog(dialog)) {
    logger.debug("[onpage-dialog]: ping message, no dialog");
    return;
  }

  // Check whether on-page dialog has been shown long enough already
  if (
    dialog.behavior.displayDuration === 0 ||
    message.displayDuration < dialog.behavior.displayDuration
  ) {
    logger.debug("[onpage-dialog]: ping message, duration exceeded");
    return;
  }

  const { displayCount } = getStats(dialog.id);

  void removeDialog(sender.page.id, dialog);
  uiServerLogger.behavior("dialog_ignored", dialog.ipmId ?? "", dialog.ipmId);
  logPersistentOpdEvent("ignored", dialog, displayCount, "display_duration_elapsed");
}

/**
 * Handles "tab-removed" tab session storage event
 *
 * @param data - Event data
 */
function handleTabRemovedEvent(data: TabRemovedEventData): void {
  const { tabId, value: dialog } = data;
  logger.debug("[onpage-dialog]: Handle Tab Removed Event");
  if (!isDialog(dialog)) {
    logger.debug("[onpage-dialog]: Handle Tab Removed Event, no dialog");
    return;
  }

  const { displayCount } = getStats(dialog.id);

  logDisplayDuration(dialog, "tab_removed");
  void removeDialog(tabId, dialog);
  uiServerLogger.behavior("dialog_ignored", dialog.ipmId ?? "", dialog.ipmId);
  logPersistentOpdEvent("ignored", dialog, displayCount, "tab_removed");
}

/**
 * Handles "tab-navigated" tab session storage event, fired when the tab
 * navigates to a new URL (e.g. user click, redirect). The session entry has
 * not yet been cleared at this point; the event payload carries the dialog.
 *
 * @param data - Event data
 */
function handleTabNavigatedEvent(data: TabRemovedEventData): void {
  const { value: dialog } = data;

  if (!isDialog(dialog)) {
    return;
  }

  logDisplayDuration(dialog, "tab_navigated");

  if (getCampaignConfig(dialog.ipmId) === null) {
    return;
  }

  // A dialog that stays up until the user acts can only end without an
  // interaction by the tab navigating away or closing, so this is where most
  // impressions of such a campaign end
  logPersistentOpdEvent("ignored", dialog, getStats(dialog.id).displayCount, "tab_navigated");
}

/**
 * Injects the necessary user style and content script into the tab
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
      files: ["adblock-onpage-dialog-user.css"],
      origin: "USER",
      target: { tabId },
    });
    await browser.scripting.executeScript({
      files: ["onpage-dialog.postload.js"],
      target: { tabId },
    });
  } else {
    await browser.tabs.insertCSS(tabId, {
      file: "adblock-onpage-dialog-user.css",
      allFrames: false,
      cssOrigin: "user",
      runAt: "document_start",
    });
    await browser.tabs.executeScript(tabId, {
      file: "onpage-dialog.postload.js",
      allFrames: false,
    });
  }
}

/**
 * Indicates whether user wants to ignore dialogs
 *
 * @returns whether dialogs should be ignored
 */
async function shouldBeIgnored(): Promise<boolean> {
  // Ignore and dismiss command if user opted-out of marketing messages
  if (Prefs.get("marketing_opt_out") === true) {
    logger.debug("[onpage-dialog]: marketing_opt_out - enabled");
    return true;
  }

  // Ignore and dismiss command if user opted-out of 'surveys'
  if (getSettings().show_survey === false) {
    logger.debug("[onpage-dialog]: show_survey - disabled");
    return true;
  }

  // Ignore and dismiss command if user opted-out of 'surveys'
  if (getSettings().suppress_surveys) {
    logger.debug("[onpage-dialog]: suppress_surveys - enabled");
    return true;
  }

  // Ignore and dismiss command if user opted-out of 'on page messages'
  if (getSettings().onpageMessages === false) {
    logger.debug("[onpage-dialog]: onpageMessages - disabled");
    return true;
  }
  return false;
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
  dialog: Dialog,
): Promise<ShowOnpageDialogResult> {
  // Ignore and dismiss dialog if user opted-out of notifications
  if (await shouldBeIgnored()) {
    logger.debug("[onpage-dialog]: User ignores notifications");
    return ShowOnpageDialogResult.rejected;
  }

  const campaignConfig = getCampaignConfig(dialog.ipmId);

  // Check if the global dialog cool down period is still ongoing. Campaigns
  // configured to ignore it skip this check.
  if (campaignConfig?.ignoreCooldown !== true && (await isCoolDownPeriodOngoing())) {
    logger.debug("[onpage-dialog]: Cool down period still ongoing");
    return ShowOnpageDialogResult.ignored;
  }

  const stats = getStats(dialog.id);
  const shouldDialogBeDismissed = shouldBeDismissed(dialog, stats, campaignConfig?.maxImpressions);
  const shouldDialogBeShown = await shouldBeShown(tab, dialog, stats);

  // Reject commands that should be dismissed. This is where a campaign whose
  // impressions all ended by navigation reaches its cap: those impressions
  // never go through removeDialog, so this is the only point at which the
  // campaign is retired. Returning "rejected" makes the caller dismiss it.
  if (shouldDialogBeDismissed) {
    logger.debug("[onpage-dialog]: Reject dialog");
    logPersistentOpdEvent("exhausted", dialog, stats.displayCount);
    return ShowOnpageDialogResult.rejected;
  }

  // Ignore and dismiss dialog that should be shown in a given tab,
  // if such tab already contains a dialog. A campaign that is meant to be
  // shown more than once is only skipped, rather than dismissed for good.
  if (shouldDialogBeShown && (await assignedDialogs.has(tabId))) {
    logger.debug("[onpage-dialog]: Tab already contains dialog");
    return campaignConfig === null
      ? ShowOnpageDialogResult.rejected
      : ShowOnpageDialogResult.ignored;
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
  // Read the count again rather than reusing the one from before the tab was
  // claimed: another tab loading at the same time may have spent an impression
  // in between. The cap was still checked against the earlier read, so two
  // tabs claiming at once can take the campaign one impression past it.
  const displayCount = getStats(dialog.id).displayCount + 1;
  setStats(dialog.id, {
    displayCount,
    lastDisplayTime: now,
  });

  // Campaigns that ignore the cool down don't start one for other campaigns
  // either, so they neither read nor write the shared timestamp
  if (campaignConfig?.ignoreCooldown !== true) {
    await Prefs.set(lastShownKey, now);
  }

  try {
    await injectDialog(tabId);
  } catch (ex) {
    logger.reportAndLogError(ex, "[onpage-dialog] Injection of dialog failed");
    logPersistentOpdEvent("injection_failed", dialog, displayCount, classifyInjectionFailure(ex));
    return ShowOnpageDialogResult.error;
  }

  uiServerLogger.behavior("dialog_injected", dialog.ipmId ?? "", dialog.ipmId);
  logPersistentOpdEvent("rendered", dialog, displayCount);
  return ShowOnpageDialogResult.shown;
}

/**
 * Checks whether given candidate is a tab page
 *
 * @param candidate - Candidate
 *
 * @returns whether given candidate is a tab page
 */
function isTabPage(candidate: unknown): candidate is TabPage {
  return (
    candidate !== null && typeof candidate === "object" && "id" in candidate && "url" in candidate
  );
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
  dismissDialogFn = dismissDialog,
): Promise<void> {
  if (!tab.id) {
    return;
  }

  for (const dialog of dialogs) {
    // Ignore and dismiss command if it has expired
    if (typeof dialog.ipmId === "string") {
      const command = getCommand(dialog.ipmId);
      // If the command disappears from storage, it means it's expired
      if (command && isCommandExpired(command)) {
        logger.error("[onpage-dialog]: Command has expired.");
        dismissDialogFn(dialog);
        continue;
      }
    }

    // Ignore and dismiss 'cookie banner' OPDs if user
    // has the cookie premium filter list activated
    if (isCookieBannerDialog(dialog)) {
      // eslint-disable-next-line no-await-in-loop
      const subs = (await SubscriptionAdapter.getSubscriptionsMinusText()) as Record<
        string,
        unknown
      >;
      const cookieSubsbscriptionId = "cookies-premium";
      const isCookieSubscriptionActive = Object.keys(subs).includes(cookieSubsbscriptionId);

      if (isCookieSubscriptionActive) {
        logger.debug(
          "[onpage-dialog]: Dismiss 'cookie banner' OPD due to Premium cookie subscription active",
        );
        dismissDialogFn(dialog);
        continue;
      }
    }

    // eslint-disable-next-line no-await-in-loop
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
  // e.g. pages that simulate navigation by changing browser session history.
  // Reads via `getQueued` rather than `get` so this can't run ahead of the
  // `clearStorage` cleanup this same navigation's "loading" event already
  // queued, which would otherwise find a stale assignment here and bail out
  // before ever handing the page to `showDialogFromList`.
  try {
    const assigned = await assignedDialogs.getQueued(page.id);
    if (isDialog(assigned)) {
      if (getCampaignConfig(assigned.ipmId) === null) {
        // keep dialogs whose communication with the extension is not lost
        // and ignore handling any other command in the extension
        logger.debug("[onpage-dialog]: Tab already contains dialog");
        return;
      }

      // A configured campaign is meant to come back on the next document, so
      // an assignment left over from the document that just went away is
      // stale rather than a dialog that is still on the page. Dropping it
      // here keeps the campaign from depending on the navigation teardown
      // having landed first.
      await assignedDialogs.delete(page.id);

      // For a regular navigation, the "loading" event's clearStorage already
      // ran the "tab-navigated" listener and reported this impression before
      // `getQueued` above could return an assignment here, so this branch
      // only fires when no "loading" event preceded this one, e.g. a page
      // simulating navigation via the History API.
      //
      // The duration this reports runs to the moment the next document
      // finished loading rather than to the navigation itself, so it carries
      // the page load with it.
      logDisplayDuration(assigned, "tab_navigated");
      logPersistentOpdEvent(
        "ignored",
        assigned,
        getStats(assigned.id).displayCount,
        "tab_navigated",
      );
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

  if (tab.incognito || typeof tab.url !== "string" || !/^https?:/.test(tab.url)) {
    return;
  }

  // The tab may have moved on to another document while this event was being
  // handled, e.g. a new tab's initial "about:blank" page navigated right away.
  // That document gets its own "loaded" event, and handling it here as well
  // would have both events compete for the same page.
  if (new URL(tab.url).href !== page.url.href) {
    logger.debug("[onpage-dialog]: Tab has navigated away from page");
    return;
  }

  // Now sort the waiting dialogs by priority.
  const dialogs = Array.from(unassignedDialogs.values()).sort(compareDialogsByPriority);

  void showDialogFromList(dialogs, tab);
}

/**
 * Handles "cookie-banner.detected" messages
 *
 * @param message - Message
 * @param sender - Message sender
 * @param processCookieBannerDialogs - Callback to process cookie banner dialogs
 */
export async function handleCookieBannerDetected(
  message: Message,
  sender: MessageSender,
  processCookieBannerDialogs = showDialogFromList,
): Promise<void> {
  logger.debug("[onpage-dialog]: Cookie banner detected");
  const { page } = sender;

  let tab = null;
  try {
    tab = await browser.tabs.get(page.id);
  } catch (ex) {
    return;
  }

  if (!tab) {
    return;
  }

  if (!tab.id) {
    return;
  }

  pagesWithCookieBanner.add(tab.id);

  // Sort the waiting dialogs by priority.
  let dialogs = Array.from(unassignedDialogs.values()).sort(compareDialogsByPriority);
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

    const dialog = await assignedDialogs.get(tab.id);
    await removeDialog(tab.id, dialog, { keepStorage: true });
  }
}

/**
 * Initializes on-page manager
 */
export async function start(): Promise<void> {
  // Timing configurations have to be in place before any page load is handled.
  // An unknown timing makes the dismissal check reject the dialog, and the
  // caller then dismisses the campaign for good rather than skipping a single
  // impression.
  await setupTimings();

  // Handle messages from content scripts
  port.on("onpage-dialog.close", handleCloseMessage);
  port.on("onpage-dialog.continue", handleContinueMessage);
  port.on("onpage-dialog.get", handleGetMessage);
  port.on("onpage-dialog.ping", handlePingMessage);
  port.on("cookie-banner.detected", handleCookieBannerDetected);

  ext.addTrustedMessageTypes(null, [
    "onpage-dialog.continue",
    "onpage-dialog.close",
    "onpage-dialog.get",
    "onpage-dialog.ping",
    "cookie-banner.detected",
  ]);

  // Dismiss dialog when tab used for storing session data gets closed
  assignedDialogs.on("tab-removed", handleTabRemovedEvent);

  // Log display duration when tab navigates while a dialog is assigned
  assignedDialogs.on("tab-navigated", handleTabNavigatedEvent);

  // Dismiss detection of cookie banner when tab gets closed
  ext.pages.onRemoved.addListener((tabId: number) => {
    if (pagesWithCookieBanner.has(tabId)) {
      pagesWithCookieBanner.delete(tabId);
    }
  });

  // Handle commands
  ext.pages.onLoaded.addListener(handlePageLoadedEvent);

  // Campaign configurations are read after the listeners are attached, because
  // reading them waits on the experiments state and a page load arriving while
  // that is pending would find no listener at all. The command handler is
  // registered only once they are in place: a campaign evaluated without its
  // configuration would run on the default cap of one impression and be
  // dismissed permanently, which is worse than the wait.
  await setupCampaignConfigs(logger);

  setDialogCommandHandler(handleDialogCommand, clearCommands);
}
