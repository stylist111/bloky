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

import * as browser from "webextension-polyfill";
import { ExtendedInstallType } from "~/management";
import {
  CommandEventType,
  CommandName,
  createSafeOriginUrl,
  dismissCommand,
  doesLicenseStateMatch,
  getBehavior,
  getCommand,
  isCommandExpired,
  recordEvent,
} from "../../ipm/background";

import * as logger from "../../utilities/background";
import { getSettings, settings } from "../../prefs/background/settings";
import { CreationMethod, isNewTabBehavior, NewTab, setNewTabCommandHandler } from "./middleware";
import {
  NewTabEventType,
  NewTabErrorEventType,
  NewTabExitEventType,
  blockCountQueryParameter,
  lastShownKey,
  coolDownPeriodKey,
} from "./tab-manager.types";
import { Prefs } from "../../alias/prefs";
import { checkLanguage } from "../../ipm/background/language-check";

const tabIds = new Set<number | undefined>();

const onCreatedHandlerByIPMids = new Map();
const onUpdatedHandlerByIPMids = new Map();

const openNewtabOnUpdatedHandlerByIPMids = new Map();

let newTabCounter = 0;

/**
 *  Count interval at which to send the number of new tabs opened
 *  that are not blank (HTTP/S and browser pages)
 */
const newTabMessageSendTrigger = [1, 10, 20, 100, 200];

/**
 * List of tabs that we still need to open.
 */
const waitingTabs: Record<string, NewTab> = {};

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
export function compareNewTabRequestsByPriority(newTabA: NewTab, newTabB: NewTab): number {
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
 * Registers an event with the data collection feature.
 *
 * @param ipmId The ipm id to register the event for
 * @param name The event name to register
 */
function registerEvent(
  ipmId: string,
  name: CommandEventType | NewTabEventType | NewTabExitEventType | NewTabErrorEventType,
): void {
  recordEvent(ipmId, CommandName.createTab, name);
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
 * Checks whether the updated tab is one that we created ourselves. If it is
 * and has finished loading, we register an event to be sent to the IPM server.
 *
 * @param tabId - The id of the tab updated
 * @param changeInfo - Lists the changes to the state of the tab that is updated
 * @param tab - The tab updated
 */
const openNewtabOnUpdated = (
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab,
) => {
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
  const onUpdatedHandler = openNewtabOnUpdatedHandlerByIPMids.get(ipmId);
  openNewtabOnUpdatedHandlerByIPMids.delete(ipmId);
  browser.tabs.onUpdated.removeListener(onUpdatedHandler);
  registerEvent(ipmId, NewTabEventType.loaded);
};

/**
 * Adds a query parameter to the given URL that contains the number of
 * blocked requests, and returns the new URL.
 *
 * Will yield `null` if the URL is not well-formed.
 *
 * @param urlString A well-formed URL
 * @returns The URL with an added block count parameter
 */
async function addBlockCountToURL(urlString: string): Promise<string | null> {
  let url;
  try {
    url = new URL(urlString);
  } catch (_) {
    return null;
  }

  await Prefs.untilLoaded;
  const blockCount = Prefs.get("blocked_total");
  url.searchParams.append(blockCountQueryParameter, blockCount);
  return url.toString();
}

/**
 * Opens the new tab to the URL specified on the IPM command
 *
 * @param ipmId - IPM ID
 */
async function openNewtab(): Promise<void> {
  logger.debug("[new-tab]:openNewtab");

  // Sort the waiting new tab candidates by priority.
  const candidates = Object.values(waitingTabs).sort(compareNewTabRequestsByPriority);

  // Iterate over list and try until a tab was opened or the list is empty.
  for (const candidate of candidates) {
    logger.debug("[new-tab]:openNewtab");
    const { ipmId } = candidate;

    // Run mandatory language skew check
    void checkLanguage(ipmId);

    removeListeners(ipmId);

    // Check if the global new tab cool down period is still ongoing.
    // eslint-disable-next-line no-await-in-loop
    if (await isCoolDownPeriodOngoing()) {
      logger.debug("[new-tab]: Cool down period still ongoing");
      // We need to exit the loop here. Not only to save unneeded iterations,
      // but also to prevent a priority mismatch for the case the period
      // might end during the iteration.
      return;
    }

    // Ignore and dismiss command if it has no behavior
    const behavior = getBehavior(ipmId);
    if (!isNewTabBehavior(behavior)) {
      logger.debug("[new-tab]: No command behavior");
      registerEvent(ipmId, NewTabErrorEventType.noBehaviorFound);
      dismissCommand(ipmId);
      continue;
    }
    // Ignore and dismiss command if License states doesn't match the license state of the command
    // eslint-disable-next-line no-await-in-loop
    if (!(await doesLicenseStateMatch(behavior))) {
      logger.debug("[new-tab]: License state mis-match");
      registerEvent(ipmId, NewTabErrorEventType.licenseStateNoMatch);
      dismissCommand(ipmId);
      continue;
    }

    const targetUrl = createSafeOriginUrl(behavior.target);
    if (!targetUrl) {
      registerEvent(ipmId, NewTabErrorEventType.noUrlFound);
      dismissCommand(ipmId);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const url = await addBlockCountToURL(targetUrl);
    if (url === null) {
      recordEvent(ipmId, CommandName.createTab, NewTabErrorEventType.noUrlFound);
      dismissCommand(ipmId);
      logger.debug("[new-tab]: Invalid URL.");
      continue;
    }

    const command = getCommand(ipmId);
    if (!command) {
      continue;
    }

    // Ignore and dismiss command if it has expired
    if (isCommandExpired(command)) {
      logger.error("[new-tab]: Command has expired.");
      registerEvent(ipmId, CommandEventType.expired);
      dismissCommand(ipmId);
      continue;
    }

    const loadEventListener = openNewtabOnUpdated.bind(null);
    browser.tabs.onUpdated.addListener(loadEventListener);

    // eslint-disable-next-line no-await-in-loop
    const tab = await browser.tabs.create({ url }).catch((error) => {
      logger.error("[new-tab]: create tab error", error);
      registerEvent(ipmId, NewTabErrorEventType.tabCreationError);
      return null;
    });

    if (tab === null || typeof tab.id !== "number") {
      // There was an error during tab creation. Let's retry later.
      registerEvent(ipmId, NewTabErrorEventType.tabCreationError);
      continue;
    }

    createdTabsMap.set(tab.id, ipmId);
    openNewtabOnUpdatedHandlerByIPMids.set(ipmId, loadEventListener);

    // eslint-disable-next-line no-await-in-loop
    await Prefs.set(lastShownKey, Date.now());
    registerEvent(ipmId, NewTabEventType.created);
    dismissCommand(ipmId);
  }
}

/**
 * Removes the create, update and remove listeners that were set up for the
 * given IPM id.
 *
 * @param ipmId The IPM id to delete the handlers for
 */
function removeListeners(ipmId: string): void {
  const onCreatedHandler = onCreatedHandlerByIPMids.get(ipmId);
  onCreatedHandlerByIPMids.delete(ipmId);
  const onUpdatedHandler = onUpdatedHandlerByIPMids.get(ipmId);
  onUpdatedHandlerByIPMids.delete(ipmId);

  // If we're here via the `force` method, we don't have handlers
  if (typeof onCreatedHandler !== "undefined") {
    browser.tabs.onCreated.removeListener(onCreatedHandler);
    browser.tabs.onUpdated.removeListener(onUpdatedHandler);
  }
  // eslint-disable-next-line no-use-before-define
  browser.tabs.onRemoved.removeListener(onRemoved);
}

/**
 * Once we've determined the conditions to open new are met,
 * do some housecleaning and then open the new tab
 *
 * @param ipmId - IPM ID
 */
const openNotificationTab = () => {
  tabIds.clear();
  openNewtab();
};

/**
 * Event handler for the on tab create event
 *
 * @param tab - The tab created
 */
const onCreated = (tab: browser.Tabs.Tab) => {
  // Firefox loads its New Tab Page immediately and doesn't notify us
  // when it's complete so we need to open our new tab already here.
  if (tab.url === "about:newtab") {
    openNotificationTab();
    return;
  }
  tabIds.add(tab.id);
};

/**
 * Event handler for the on tab removed event
 *
 * @param tabId - The id of the tab removed
 */
const onRemoved = (tabId: number) => {
  tabIds.delete(tabId);
};

/**
 * Event handler for the on tab updated event
 *
 * @param tabId - The id of the tab updated
 * @param changeInfo - Lists the changes to the state of the tab that is updated
 * @param tab - The tab updated
 */
const onUpdated = (
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab,
) => {
  // Only look at tabs that have been opened since we started listening
  // and that have completed loading.
  if (!tabIds.has(tabId) || changeInfo.status !== "complete") {
    return;
  }

  tabIds.delete(tabId);

  // Open our own new tab only when a new tab gets opened
  // that isn't part of the user browsing the web.
  if (tab.url && /^https?:/.test(tab.url)) {
    newTabCounter += 1;
    const ipmId = createdTabsMap.get(tabId);
    if (typeof ipmId === "string" && newTabMessageSendTrigger.includes(newTabCounter)) {
      recordEvent(ipmId, CommandName.createTab, `${NewTabEventType.has_content}:${newTabCounter}`);
    }
    return;
  }

  openNotificationTab();
};

/**
 * Handles new tab command
 *
 * @param ipmId - IPM ID
 */
async function handleCommand(ipmId: string): Promise<void> {
  logger.debug("[new-tab]:tab manager handleCommand", ipmId);

  const { installType } = await browser.management.getSelf();
  if ((installType as ExtendedInstallType) === "admin") {
    registerEvent(ipmId, NewTabExitEventType.admin);
    dismissCommand(ipmId);
    return;
  }

  await settings.onload();
  // Ignore and dismiss command if user opted-out of 'surveys'
  if (getSettings().suppress_update_page) {
    logger.debug("[new-tab]:suppress_update_page - true");
    registerEvent(ipmId, NewTabExitEventType.disabled);
    dismissCommand(ipmId);
    return;
  }

  // Ignore and dismiss command if behavior is invalid.
  logger.debug("[new-tab]:openNewtab");
  const behavior = getBehavior(ipmId);
  if (!isNewTabBehavior(behavior)) {
    logger.debug("[new-tab]: Invalid command behavior");
    registerEvent(ipmId, NewTabErrorEventType.noBehaviorFound);
    dismissCommand(ipmId);
    return;
  }

  // Let the IPM know we received the command.
  registerEvent(ipmId, NewTabEventType.received);

  waitingTabs[ipmId] = { behavior, ipmId };

  // If the method is `force`, we don't need to create handlers.
  if (behavior.method === CreationMethod.force) {
    return;
  }

  // Add listeners
  const onCreatedHandler = onCreated.bind(null);
  onCreatedHandlerByIPMids.set(ipmId, onCreatedHandler);

  const onUpdatedHandler = onUpdated.bind(null);
  onUpdatedHandlerByIPMids.set(ipmId, onUpdatedHandler);

  browser.tabs.onCreated.addListener(onCreatedHandler);
  browser.tabs.onRemoved.addListener(onRemoved);
  browser.tabs.onUpdated.addListener(onUpdatedHandler);

  newTabCounter = 0;
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
      (candidate) => candidate.behavior.method === CreationMethod.force,
    )
  ) {
    void openNewtab();
  }
}

/**
 * Initializes new tab manager
 */
async function start(): Promise<void> {
  logger.debug("[new-tab]:tab manager start");

  setNewTabCommandHandler(handleCommand, onCommandsProcessed);
}

void start().catch(logger.error);
