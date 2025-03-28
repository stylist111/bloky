/*
 * This file is part of @eyeo/rules-utils <https://adblock.org/>,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * @eyeo/rules-utils is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * @eyeo/rules-utils is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @eyeo/rules-utils.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Generates list of recommended filter list from given data
 *
 * @param {Object[]} availableSubscriptions - List of available subscriptions
 * @param {string[]} recommendedIds - List of recommended subscription IDs
 * @param {string[]} privilegedIds = List of privileged subscription IDs
 * @returns {Object[]} - List of recommended filter lists
 */
export function getRecommendations(
  // Importing JSON files as a module in Node 18 is experimental and done
  // differently than in the browser. So instead of importing the list of
  // available subscriptions from @eyeo/filterlists directly, we need to
  // pass it as an argument.
  availableSubscriptions,
  recommendedIds,
  privilegedIds,
) {
  const recommendations = [];
  const subscriptionById = new Map(
    availableSubscriptions.map((subscription) => [
      subscription.id,
      subscription,
    ]),
  );

  for (const id of recommendedIds) {
    const subscription = subscriptionById.get(id);
    if (!subscription) {
      throw new Error(`Missing subscription: ${id}`);
    }

    if (privilegedIds.includes(id)) {
      subscription.privileged = true;
    }

    recommendations.push(subscription);
  }

  return recommendations;
}
