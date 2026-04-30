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

import {
  type ExtensionInfo,
  type GetOptions,
  type InfoType,
  type OpenOptions,
  type PageName,
  type Platform,
  type Store
} from "./category-app.types";
import * as messaging from "./messaging";
import { send } from "./utils";

/**
 * Static strings to match the browser engine to a store name.
 */
const platformToStore = new Map<Platform, Store>([
  ["chromium", "chrome"],
  ["edgehtml", "edge"],
  ["gecko", "firefox"]
]);

/**
 * Retrieves app information based on the given type
 *
 * @param what - Type of app information to return
 * @returns app information
 */
export async function get<T>(what: InfoType): Promise<T> {
  const options: GetOptions = { what };
  return await send("app.get", options);
}

/**
 * Retrieves extension information
 *
 * @returns extension information
 */
export async function getInfo(): Promise<ExtensionInfo> {
  const [application, platform] = await Promise.all([
    get<string>("application"),
    get<Platform>("platform")
  ]);

  let store: Store;
  // Edge and Opera have their own stores so we should refer to those instead
  if (application !== "edge" && application !== "opera") {
    store = platformToStore.get(platform) ?? "chrome";
  } else {
    store = application;
  }

  return {
    application,
    manifestVersion: browser.runtime.getManifest().manifest_version,
    platform,
    store
  };
}

/**
 * Listen to app-related events
 *
 * @param filter - Event names
 */
export function listen(filter: string[]): void {
  messaging.listen({ type: "app", filter });
}

/**
 * Opens extension page with the given name
 *
 * @param what - Extension page name
 */
export async function open(
  what: PageName,
  parameters: Record<string, unknown> = {}
): Promise<void> {
  const options: OpenOptions = { what, ...parameters };
  await send("app.open", options);
}

/**
 * Retrieves a snapshot of the extension's current state for debugging
 *
 * @returns extension state
 */
export async function getAdFilteringState(): Promise<unknown> {
  return await send("app.getAdFilteringState");
}

/**
 * Closes the current tab
 */
export async function close(): Promise<void> {
  await send("app.close");
}
