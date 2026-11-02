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
  type SerializableRecommendation,
  type SerializableSubscription
} from "../shared";
import {
  type AddOptions,
  type GetOptions,
  type InitializationIssues,
  type RemoveOptions,
  type ToggleOptions
} from "./category-subscriptions.types";
import * as messaging from "./messaging";
import { send } from "./utils";

/**
 * Adds the given subscription
 *
 * @param url - Subscription URL
 * @returns
 *   true if the subscription was added,
 *   false if the URL is invalid,
 *   null if the "confirm" property was set
 */
export async function add(url: string): Promise<boolean | null> {
  const options: AddOptions = { url };
  return await send("subscriptions.add", options);
}

/**
 * Retrieves the currently active subscriptions.
 *
 * @param options - Subscription query
 * @returns subscriptions
 */
export async function get(
  options?: GetOptions
): Promise<SerializableSubscription[]> {
  return await send("subscriptions.get", options ?? {});
}

/**
 * Retrieves any subscription initialization issues that may exist
 *
 * @returns information indicating presence of initialization issues
 */
export async function getInitIssues(): Promise<InitializationIssues> {
  return await send("subscriptions.getInitIssues");
}

/**
 * Retrieves a list of recommended subscriptions
 *
 * @returns list of recommended subscriptions
 */
export async function getRecommendations(): Promise<
  SerializableRecommendation[]
> {
  return await send("subscriptions.getRecommendations");
}

/**
 * Listen to subscription-related events
 *
 * @param filter - Event names
 */
export function listen(filter: string[]): void {
  messaging.listen({ type: "subscriptions", filter });
}

/**
 * Removes the given subscription
 *
 * @param url - Subscription URL
 */
export async function remove(url: string): Promise<void> {
  const options: RemoveOptions = { url };
  await send("subscriptions.remove", options);
}

/**
 * Toggles the given subscription: adds it if it is not installed, enables it
 * if it is installed but disabled, and otherwise removes it (or disables it,
 * if `keepInstalled` is set)
 *
 * @param url - Subscription URL
 * @param keepInstalled - Whether to disable the subscription instead of
 *   removing it
 * @returns
 *   true if the subscription was toggled or added,
 *   false if the URL is invalid
 */
export async function toggle(
  url: string,
  keepInstalled?: boolean
): Promise<boolean> {
  const options: ToggleOptions = { url };
  if (keepInstalled) {
    options.keepInstalled = true;
  }
  return await send("subscriptions.toggle", options);
}
