/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

export let filterEngine = {
  filterStorage: {
    subscriptions() {
      // eslint-disable-next-line no-undef
      return global.filterStorageSubscriptions;
    }
  },
  defaultMatcher: {
    match() {
      return null;
    }
  }
};
export function convertFilter() {}
// eslint-disable-next-line no-undef
export let addonBundledSubscriptions = global.addonBundledSubscriptions;
export let addonBundledSubscriptionsPath;
export default {
  start() {}
};
export function readFileContent() {}
export class EventDispatcher {}

export function getFilterTextByRuleId(id) {
  // eslint-disable-next-line no-undef
  return global.getFilterTextByRuleId(id);
}

export let IO = {};

export function disableDynamicRules() {}
export function restoreDynamicRules() {}
export function isDnrSubscriptionUpdating(url) {}
export async function _awaitSavingComplete() {}
export function shouldNotifyActive(tabId, frames) {}
