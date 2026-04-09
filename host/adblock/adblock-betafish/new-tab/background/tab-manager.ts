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
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  addCohortAssignmentsSearchParam,
  addExperimentsSearchParams,
  createSafeOriginUrl,
  dismissCommand,
  getBehavior,
  getCommand,
  isCommandExpired,
} from "@eyeo-fragments/in-product-messaging/background";

import { ExtendedInstallType } from "~/management";

import * as logger from "../../utilities/background";
import { getSettings, settings } from "../../prefs/background/settings";
import { CreationMethod, isNewTabBehavior, NewTab, setNewTabCommandHandler } from "./middleware";
import { blockCountQueryParameter, lastShownKey, coolDownPeriodKey } from "./tab-manager.types";
import { Prefs } from "../../alias/prefs";

const onCreatedHandlerByIPMids = new Map();
const onUpdatedHandlerByIPMids = new Map();

/**
 * List of tabs that we still need to open.
 */
let waitingTabs: Record<string, NewTab> = {};

/**
 * A collection of ids of tabs that have been opened since we
 * started listening.
 */
const tabIds = new Set<number>();

/**
 * A map of functions that handle update events on tabs that we have created
 * ourselves. Keys are the IPM IDs that triggered the tab creation.
 */
const onNewTabUpdateHandlerByIpmId = new Map();

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
 * Dismisses IPM command cleans up any leftovers
 *
 * @param ipmId - IPM ID
 */
function dismissNewtabCommand(ipmId: string): void {
  dismissCommand(ipmId);
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
  const onUpdatedHandler = onNewTabUpdateHandlerByIpmId.get(ipmId);
  onNewTabUpdateHandlerByIpmId.delete(ipmId);
  browser.tabs.onUpdated.removeListener(onUpdatedHandler);

  serverLogger.behavior("tab_loaded", ipmId, ipmId);
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
      dismissNewtabCommand(ipmId);
      continue;
    }

    // Ignore and dismiss command if given target URL doesn't meet safe
    // origin requirements.
    const targetUrl = createSafeOriginUrl(behavior.target);
    if (!targetUrl) {
      logger.debug("[new-tab]: Invalid target URL.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    // Add experiment and cohort query params to target URL.
    // eslint-disable-next-line no-await-in-loop
    let url: string | null = await buildTargetUrl(targetUrl);

    // eslint-disable-next-line no-await-in-loop
    url = await addBlockCountToURL(url);
    if (url === null) {
      logger.debug("[new-tab]: Invalid target URL.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    const command = getCommand(ipmId);
    if (!command) {
      // If the command disappears from storage, it means it's expired
      continue;
    }

    // Ignore and dismiss command if it has expired
    if (isCommandExpired(command)) {
      logger.error("[new-tab]: Command has expired.");
      dismissNewtabCommand(ipmId);
      continue;
    }

    const loadEventListener = openNewtabOnUpdated.bind(null);
    browser.tabs.onUpdated.addListener(loadEventListener);

    let tabId: browser.Tabs.Tab["id"];
    try {
      // eslint-disable-next-line no-await-in-loop
      const tab = await browser.tabs.create({ url });
      tabId = tab.id;
    } catch (ex) {
      // There was an error during tab creation. Let's retry later.
      logger.error(`[new-tab]: Tab creation error for IPM id "${ipmId}"`, ex);
      continue;
    }

    if (typeof tabId === "undefined") {
      logger.error(`[new-tab]: Invalid ID "${tabId}" for created tab for IPM ID "${ipmId}"`);
      continue;
    }

    createdTabsMap.set(tabId, ipmId);
    onNewTabUpdateHandlerByIpmId.set(ipmId, loadEventListener);

    // eslint-disable-next-line no-await-in-loop
    await Prefs.set(lastShownKey, Date.now());
    serverLogger.behavior("tab_created", ipmId, ipmId);
    dismissNewtabCommand(ipmId);
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

  if (typeof tab.id !== "number") {
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
  createdTabsMap.delete(tabId);
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

  // Don't open new tabs if we're on a managed installation
  const { installType } = await browser.management.getSelf();
  if ((installType as ExtendedInstallType) === "admin") {
    dismissNewtabCommand(ipmId);
    return;
  }

  await settings.onload();
  // Ignore and dismiss command if user opted-out of 'update-page'
  if (getSettings().suppress_update_page) {
    logger.debug("[new-tab]: suppress_update_page - true");
    dismissNewtabCommand(ipmId);
    return;
  }

  // Don't open new tabs if user opted out of marketing messages
  await Prefs.untilLoaded;
  if (Prefs.get("marketing_opt_out")) {
    logger.debug("[new-tab]: marketing_opt_out - true");
    dismissNewtabCommand(ipmId);
    return;
  }

  // Don't open new tabs for users in the reverse trial OPD experiment
  const reverseTrialFlag = await ewe.experiments.getFlag("show-reverse-trial-opd");
  if (reverseTrialFlag) {
    logger.debug("[new-tab]: User is in reverse trial OPD experiment");
    dismissNewtabCommand(ipmId);
    return;
  }

  // Ignore and dismiss command if behavior is invalid
  logger.debug("[new-tab]:openNewtab");
  const behavior = getBehavior(ipmId);
  if (!isNewTabBehavior(behavior)) {
    logger.debug("[new-tab]: Invalid command behavior");
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
  const onCreatedHandler = onCreated.bind(null);
  onCreatedHandlerByIPMids.set(ipmId, onCreatedHandler);

  const onUpdatedHandler = onUpdated.bind(null);
  onUpdatedHandlerByIPMids.set(ipmId, onUpdatedHandler);

  browser.tabs.onCreated.addListener(onCreatedHandler);
  browser.tabs.onRemoved.addListener(onRemoved);
  browser.tabs.onUpdated.addListener(onUpdatedHandler);
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
      (candidate) => candidate.behavior.method === CreationMethod.force,
    )
  ) {
    await openNewtab();
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
  logger.debug("[new-tab]:tab manager start");

  setNewTabCommandHandler(handleCommand, clearCommands, onCommandsProcessed);
}
