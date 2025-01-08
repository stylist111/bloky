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
import {
  CommandEventType,
  CommandName,
  createSafeOriginUrl,
  dismissCommand,
  doesLicenseStateMatch,
  getBehavior,
  getCommand,
  isCommandExpired,
  recordEvent
} from "../../ipm/background";
import * as logger from "../../logger/background";
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
  CreationError,
  CreationSuccess,
  CreationRejection,
  lastShownKey,
  coolDownPeriodKey
} from "./tab-manager.types";
import { checkLanguage } from "~/ipm/background/language-check";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";

/**
 * List of tabs that we still need to open.
 */
const waitingTabs: Record<string, NewTab> = {};

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
const newTabUpdateListeners = new Map<string, Listener>();

/**
 * Maps the IDs of the tabs we crated to the IPM IDs that caused their creation.
 */
const createdTabsMap = new Map<number, string>();

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
 * Checks whether the global new tab cool down period is still ongoing.
 *
 * @returns true if the cool down period is till ongoing, false if not
 */
export async function isCoolDownPeriodOngoing(): Promise<boolean> {
  await Prefs.untilLoaded;
  return Prefs.get(lastShownKey) + Prefs.get(coolDownPeriodKey) > Date.now();
}

/**
 * Registers an event with the data collection feature.
 *
 * @param ipmId The ipm id to register the event for
 * @param name The event name to register
 */
function registerEvent(
  ipmId: string,
  name: CommandEventType | CreationSuccess | CreationError | CreationRejection
): void {
  recordEvent(ipmId, CommandName.createTab, name);
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

  registerEvent(ipmId, CreationSuccess.loaded);

  const listener = newTabUpdateListeners.get(ipmId);
  if (typeof listener === "undefined") {
    return;
  }
  newTabUpdateListeners.delete(ipmId);
  browser.tabs.onUpdated.removeListener(listener);
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

    // Run mandatory language skew check
    void checkLanguage(ipmId);

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
      registerEvent(ipmId, CreationError.invalidBehavior);
      dismissCommand(ipmId);
      continue;
    }

    // Ignore and dismiss command if license states mismatch.
    if (!(await doesLicenseStateMatch(behavior))) {
      logger.debug("[new-tab]: License state mismatch.");
      registerEvent(ipmId, CreationError.licenseStateMismatch);
      dismissCommand(ipmId);
      continue;
    }

    // Ignore and dismiss command if given target URL doesn't meet safe
    // origin requirements.
    const targetUrl = createSafeOriginUrl(behavior.target);
    if (targetUrl === null) {
      logger.debug("[new-tab]: Invalid target URL.");
      registerEvent(ipmId, CreationError.invalidURL);
      dismissCommand(ipmId);
      continue;
    }

    // Ignore and dismiss command if it has expired
    const command = getCommand(ipmId);
    if (!command) {
      continue;
    }
    if (isCommandExpired(command)) {
      logger.error("[new-tab]: Command has expired.");
      registerEvent(ipmId, CommandEventType.expired);
      dismissCommand(ipmId);
      continue;
    }

    // Add update listener to see when our tab is done loading.
    const loadEventListener = onNewTabUpdated.bind(null);
    browser.tabs.onUpdated.addListener(loadEventListener);

    const tab = await browser.tabs.create({ url: targetUrl }).catch((error) => {
      logger.error("[new-tab]: create tab error", error);
      return null;
    });

    if (tab === null || typeof tab.id !== "number") {
      // There was an error during tab creation. Let's retry later.
      registerEvent(ipmId, CreationError.tabCreationError);
      continue;
    }

    createdTabsMap.set(tab.id, ipmId);
    newTabUpdateListeners.set(ipmId, loadEventListener);

    await Prefs.set(lastShownKey, Date.now());
    registerEvent(ipmId, CreationSuccess.created);
    dismissCommand(ipmId);
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
async function handleCommand(ipmId: string): Promise<void> {
  logger.debug("[new-tab]: tab manager handleCommand", ipmId);

  // Don't open new tabs if we're in an automation scenario.
  if (navigator.webdriver) {
    return;
  }

  // Don't open new tabs if we're on a managed installation.
  const { installType } = await browser.management.getSelf();
  if ((installType as unknown) === "admin") {
    registerEvent(ipmId, CreationRejection.admin);
    dismissCommand(ipmId);
    return;
  }

  // Don't open new tabs if something's wrong with the data we got.
  const behavior = getBehavior(ipmId);
  if (!isNewTabBehavior(behavior)) {
    logger.debug("[new-tab]: Invalid command behavior.");
    registerEvent(ipmId, CreationError.invalidBehavior);
    dismissCommand(ipmId);
    return;
  }

  waitingTabs[ipmId] = { behavior, ipmId };

  // If the method is `force`, we don't need to create handlers.
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
function onCommandsProcessed(): void {
  // Do we have "force" commands? If so, try to open a tab right now.
  if (
    Array.from(Object.values(waitingTabs)).some(
      (candidate) => candidate.behavior.method === CreationMethod.force
    )
  ) {
    void openNewTab();
  }
}

/**
 * Initializes new tab manager
 */
export async function start(): Promise<void> {
  logger.debug("[new-tab]: tab manager start");
  setNewTabCommandHandler(handleCommand, onCommandsProcessed);
}
