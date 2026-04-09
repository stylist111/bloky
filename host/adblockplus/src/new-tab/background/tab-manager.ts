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

import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  addCohortAssignmentsSearchParam,
  addExperimentsSearchParams,
  createSafeOriginUrl,
  dismissCommand,
  getBehavior,
  getCommand,
  isCommandExpired
} from "@eyeo-fragments/in-product-messaging/background";

import * as logger from "~/logger/background";

import {
  CreationMethod,
  isNewTabBehavior,
  type NewTab,
  setNewTabCommandHandler
} from "./middleware";
import {
  ListenerType,
  type ListenerSet,
  type Listener,
  lastShownKey,
  coolDownPeriodKey
} from "./tab-manager.types";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";

/**
 * List of tabs that we still need to open.
 */
let waitingTabs: Record<string, NewTab> = {};

/**
 * Maps IPM IDs to the listeners that have been attached by them.
 */
const listenerMap = new Map<string, ListenerSet>();

/**
 * A collection of ids of tabs that have been opened since we
 * started listening.
 */
const tabIds = new Set<number>();

/**
 * A map of functions that handle update events on tabs that we have created
 * ourselves. Keys are the IPM IDs that triggered the tab creation.
 */
const onNewTabUpdateHandlerByIpmId = new Map<string, Listener>();

/**
 * Maps the IDs of the tabs we crated to the IPM IDs that caused their creation.
 */
const createdTabsMap = new Map<number, string>();

/**
 * Server logger instance for events related to the new-tab feature
 */
const serverLogger = new ewe.telemetry.ServerLogger("new_tab");

/**
 * Compares two new tab requests to see which has the higher priority.
 *
 * @param newTabA The first new tab request
 * @param newTabB The second new tab request
 * @returns -1 if newTabA has a higher priority, 1 if newTabB does, 0 if both are equal
 */
export function compareNewTabRequestsByPriority(
  newTabA: NewTab,
  newTabB: NewTab
): number {
  if (
    newTabA.behavior.method === CreationMethod.force &&
    newTabB.behavior.method !== CreationMethod.force
  ) {
    return -1;
  }

  if (
    newTabA.behavior.method !== CreationMethod.force &&
    newTabB.behavior.method === CreationMethod.force
  ) {
    return 1;
  }

  if (newTabA.behavior.priority > newTabB.behavior.priority) {
    return -1;
  }

  if (newTabA.behavior.priority < newTabB.behavior.priority) {
    return 1;
  }

  if (newTabA.ipmId < newTabB.ipmId) {
    return -1;
  }
  if (newTabA.ipmId > newTabB.ipmId) {
    return 1;
  }

  return 0;
}

/**
 * Dismisses IPM command cleans up any leftovers
 *
 * @param ipmId - IPM ID
 */
function dismissNewtabCommand(ipmId: string): void {
  dismissCommand(ipmId);
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete waitingTabs[ipmId];
}

/**
 * Checks whether the global new tab cool down period is still ongoing.
 *
 * @returns true if the cool down period is till ongoing, false if not
 */
export async function isCoolDownPeriodOngoing(): Promise<boolean> {
  await Prefs.untilLoaded;
  return Prefs.get(lastShownKey) + Prefs.get(coolDownPeriodKey) > Date.now();
}

/**
 * Listens to updates on the tab we created ourselves to check if the
 * contents have been loaded. We do this to send an event back to the
 * IPM server.
 *
 * @param tabId - The id of the tab updated
 * @param changeInfo - Lists the changes to the state of the tab that is updated
 * @param tab - The tab updated
 */
function onNewTabUpdated(
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab
): void {
  if (
    changeInfo.status !== "complete" ||
    tab === null ||
    tabId !== tab.id ||
    !createdTabsMap.has(tabId)
  ) {
    return;
  }

  const ipmId = createdTabsMap.get(tabId);
  if (typeof ipmId !== "string") {
    return;
  }

  serverLogger.behavior("tab_loaded", ipmId, ipmId);

  const listener = onNewTabUpdateHandlerByIpmId.get(ipmId);
  if (typeof listener === "undefined") {
    return;
  }
  onNewTabUpdateHandlerByIpmId.delete(ipmId);
  browser.tabs.onUpdated.removeListener(listener);
}

/**
 * Appends experiment and cohort query params to the given URL.
 *
 * @param targetUrl - The base URL to append params to
 * @returns The URL with params appended
 */
export async function buildTargetUrl(targetUrl: string): Promise<string> {
  let url = await addExperimentsSearchParams(targetUrl);
  if (url === null) {
    url = targetUrl;
  }

  url = await addCohortAssignmentsSearchParam(url);
  if (url === null) {
    url = targetUrl;
  }

  return url;
}

/**
 * Opens a new tab to the URL specified on the IPM command
 *
 * @param ipmId - IPM ID
 */
async function openNewTab(): Promise<void> {
  logger.debug("[new-tab]: openNewTab");

  // Sort the waiting new tab candidates by priority.
  const candidates = Object.values(waitingTabs).sort(
    compareNewTabRequestsByPriority
  );

  // Iterate over list and try until a tab was opened or the list is empty.
  for (const candidate of candidates) {
    const ipmId = candidate.ipmId;

    removeListeners(ipmId);
    listenerMap.delete(ipmId);
    tabIds.clear();

    // Check if the global new tab cool down period is still ongoing.
    if (await isCoolDownPeriodOngoing()) {
      logger.debug("[new-tab]: Cool down period still ongoing");
      // We need to exit the loop here. Not only to save unneeded iterations,
      // but also to prevent a priority mismatch for the case the period
      // might end during the iteration.
      return;
    }

    // Ignore and dismiss command if it has invalid behavior.
    const behavior = getBehavior(ipmId);
    if (!isNewTabBehavior(behavior)) {
      logger.debug("[new-tab]: Invalid command behavior.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    // Ignore and dismiss command if given target URL doesn't meet safe
    // origin requirements.
    const targetUrl = createSafeOriginUrl(behavior.target);
    if (targetUrl === null) {
      logger.debug("[new-tab]: Invalid target URL.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    // Add experiment and cohort query params to target URL.
    // eslint-disable-next-line no-await-in-loop
    const url = await buildTargetUrl(targetUrl);

    // Ignore and dismiss command if it has expired
    const command = getCommand(ipmId);
    if (!command) {
      // If the command disappears from storage, it means it's expired
      continue;
    }
    if (isCommandExpired(command)) {
      logger.error("[new-tab]: Command has expired.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    // Add update listener to see when our tab is done loading.
    const loadEventListener = onNewTabUpdated.bind(null);
    browser.tabs.onUpdated.addListener(loadEventListener);

    let tabId: browser.Tabs.Tab["id"];
    try {
      const tab = await browser.tabs.create({ url });
      tabId = tab.id;
    } catch (ex) {
      // There was an error during tab creation. Let's retry later.
      logger.error(`[new-tab]: Tab creation error for IPM id "${ipmId}"`, ex);
      continue;
    }

    if (typeof tabId === "undefined") {
      logger.error(
        `[new-tab]: Invalid ID "${tabId}" for created tab for IPM ID "${ipmId}"`
      );
      continue;
    }

    createdTabsMap.set(tabId, ipmId);
    onNewTabUpdateHandlerByIpmId.set(ipmId, loadEventListener);

    await Prefs.set(lastShownKey, Date.now());
    serverLogger.behavior("tab_created", ipmId, ipmId);
    dismissNewtabCommand(ipmId);
  }
}

/**
 * Listens to the creation of tabs and will add their ids to our list.
 *
 * On Firefox, will directly open the new tab.
 *
 * @param tab - The tab created
 */
function onTabCreated(tab: browser.Tabs.Tab): void {
  // Firefox loads its New Tab Page immediately and doesn't notify us
  // when it's complete so we need to open our new tab already here.
  if (tab.url === "about:newtab") {
    void openNewTab();
    return;
  }

  if (typeof tab.id !== "number") {
    return;
  }

  tabIds.add(tab.id);
}

/**
 * Listens to update events on tabs and checks the updated tab to see if it
 * signals that we can open our own new tab now.
 *
 * @param tabId - The id of the tab updated
 * @param changeInfo - Lists the changes to the state of the tab that is updated
 * @param tab - The tab updated
 */
function onTabUpdated(
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab
): void {
  // Only look at tabs that have been opened since we started listening
  // and that have completed loading.
  if (!tabIds.has(tabId) || changeInfo.status !== "complete") {
    return;
  }

  tabIds.delete(tabId);

  // If we don't have a URL, we cannot run checks on it.
  if (typeof tab.url !== "string") {
    return;
  }

  // Open our own new tab only when a new tab gets opened
  // that isn't part of the user browsing the web.
  if (/^https?:/.test(tab.url)) {
    return;
  }

  void openNewTab();
}

/**
 * Listens to the removal of tabs, and will remove their ids from our list.
 *
 * @param tabId - The id of the tab removed
 */
function onTabRemoved(tabId: number): void {
  createdTabsMap.delete(tabId);
  tabIds.delete(tabId);
}

/**
 * Creates listeners for the given ipmId.
 *
 * @returns A set of three listeners
 */
function createListeners(): ListenerSet {
  return {
    [ListenerType.create]: onTabCreated.bind(null),
    [ListenerType.update]: onTabUpdated.bind(null),
    [ListenerType.remove]: onTabRemoved.bind(null)
  };
}

/**
 * Removes listeners for the given ipmId.
 *
 * @param ipmId - The ipmId to remove the listeners for
 */
function removeListeners(ipmId: string): void {
  const listeners = listenerMap.get(ipmId);
  if (typeof listeners === "undefined") {
    return;
  }

  browser.tabs.onCreated.removeListener(listeners[ListenerType.create]);
  browser.tabs.onUpdated.removeListener(listeners[ListenerType.update]);
  browser.tabs.onRemoved.removeListener(listeners[ListenerType.remove]);
}

/**
 * Handles new tab command
 *
 * @param ipmId - IPM ID
 */
export async function handleCommand(ipmId: string): Promise<void> {
  logger.debug("[new-tab]: tab manager handleCommand", ipmId);

  // Don't open new tabs if we're on a managed installation
  const { installType } = await browser.management.getSelf();
  if ((installType as unknown) === "admin") {
    dismissNewtabCommand(ipmId);
    return;
  }

  // Don't open new tabs if user opted out of new tabs
  await Prefs.untilLoaded;
  if (Prefs.get("suppress_first_run_page")) {
    return;
  }

  // Don't open new tabs if user opted out of marketing messages
  const ignoredCategories = await ewe.notifications.getIgnoredCategories();
  if (ignoredCategories.includes("*")) {
    dismissNewtabCommand(ipmId);
    return;
  }

  // Don't open new tabs for users in the reverse trial OPD experiment
  const reverseTrialFlag = await ewe.experiments.getFlag(
    "show-reverse-trial-opd"
  );
  if (reverseTrialFlag) {
    logger.debug("[new-tab]: User is in reverse trial OPD experiment");
    dismissNewtabCommand(ipmId);
    return;
  }

  const behavior = getBehavior(ipmId);

  // Don't open new tabs if something's wrong with the data we got
  if (!isNewTabBehavior(behavior)) {
    logger.debug("[new-tab]: Invalid command behavior.");
    dismissNewtabCommand(ipmId);
    return;
  }

  waitingTabs[ipmId] = { behavior, ipmId };

  serverLogger.behavior("command_ready", ipmId, ipmId);

  // If the method is `force`, we don't need to create handlers
  if (behavior.method === CreationMethod.force) {
    return;
  }

  // Add listeners
  const listeners = createListeners();
  listenerMap.set(ipmId, listeners);

  browser.tabs.onCreated.addListener(listeners[ListenerType.create]);
  browser.tabs.onUpdated.addListener(listeners[ListenerType.update]);
  browser.tabs.onRemoved.addListener(listeners[ListenerType.remove]);
}

/**
 * Checks if we need to open a tab already right now.
 * We run this check when we're done processing commands from an IPM server
 * ping.
 */
async function onCommandsProcessed(): Promise<void> {
  // Do we have "force" commands? If so, try to open a tab right now.
  if (
    Array.from(Object.values(waitingTabs)).some(
      (candidate) => candidate.behavior.method === CreationMethod.force
    )
  ) {
    await openNewTab();
  }
}

/**
 * Clears active commands
 */
async function clearCommands(): Promise<void> {
  // clearing listeners for commands that are still waiting to be opened
  for (const ipmId of Object.keys(waitingTabs)) {
    removeListeners(ipmId);
  }
  listenerMap.clear();
  waitingTabs = {};

  // clearing new tabs opened by IPM commands
  for (const [tabID, ipmId] of createdTabsMap) {
    const updateListener = onNewTabUpdateHandlerByIpmId.get(ipmId);
    if (updateListener) {
      browser.tabs.onUpdated.removeListener(updateListener);
    }

    try {
      await browser.tabs.remove(tabID);
    } catch (ex) {
      // Ignore if tab has already been closed since we stopped listening,
      // which can occur while running end-to-end tests
    }
  }
  onNewTabUpdateHandlerByIpmId.clear();
  createdTabsMap.clear();
  tabIds.clear();
}

/**
 * Initializes new tab manager
 */
export async function start(): Promise<void> {
  logger.debug("[new-tab]: tab manager start");
  /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
  setNewTabCommandHandler(handleCommand, clearCommands, onCommandsProcessed);
}
