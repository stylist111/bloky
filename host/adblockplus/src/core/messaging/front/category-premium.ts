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

import { type PremiumState } from "../../../premium/shared";
import { type PremiumSubscriptionsState } from "../../../premium-subscriptions/shared";
import { type PremiumSubscriptionsAddRemoveOptions } from "../shared";
import * as messaging from "./messaging";
import { send } from "./utils";

/**
 * Add Premium subscription with given type
 *
 * @param subscriptionType - Subscription type
 */
export async function add(
  subscriptionType: PremiumSubscriptionsAddRemoveOptions["subscriptionType"]
): Promise<void> {
  const options: PremiumSubscriptionsAddRemoveOptions = { subscriptionType };
  await send("premium.subscriptions.add", options);
}

/**
 * Retrieves current Premium state
 *
 * @returns Premium state
 */
export async function get(): Promise<PremiumState> {
  return await send("premium.get");
}

/**
 * Retrieves state of Premium subscriptions
 *
 * @returns state of Premium subscriptions
 */
export async function getPremiumSubscriptionsState(): Promise<PremiumSubscriptionsState> {
  return await send("premium.subscriptions.getState");
}

/**
 * Listen to Premium-related events
 *
 * @param filter - Event names
 */
export function listen(filter: string[]): void {
  messaging.listen({ type: "premium", filter });
}

/**
 * Removes Premium subscription with given type
 *
 * @param subscriptionType - Subscription type
 */
export async function remove(
  subscriptionType: PremiumSubscriptionsAddRemoveOptions["subscriptionType"]
): Promise<void> {
  const options: PremiumSubscriptionsAddRemoveOptions = { subscriptionType };
  await send("premium.subscriptions.remove", options);
}
