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

import browser from "./browser.js";

import {RegularSubscription}
  from "#adblockpluscore/lib/subscriptionClasses.js";
import {filterNotifier} from "#adblockpluscore/lib/filterNotifier.js";

import {filterEngine} from "./core.js";
import {PersistentState} from "./persistence.js";
import sentry from "./sentry.js";

/**
 * The reasons a subscription can be added, enabled, disabled or removed.
 * @ignore
 */
export const REASONS = Object.freeze({
  DEFAULT: "default",
  USER_ACTION: "user_action",
  ADMIN_POLICY: "admin_policy",
  MIGRATION: "migration",
  REDIRECT: "redirect",
  PLAN_CHANGE: "plan_change",
  RECOVERY: "recovery",
  SNAPSHOT: "snapshot",
  UNKNOWN: "unknown"
});

/**
 * The states a subscription can be recorded with.
 * @ignore
 */
export const STATES = Object.freeze({
  ENABLED: "enabled",
  DISABLED: "disabled",
  REMOVED: "removed"
});

const KNOWN_REASONS = new Set(Object.values(REASONS));

const ledger = new PersistentState(
  "ewe:subscriptionLedger", browser.storage.local
);
let started = false;

function getState(subscription) {
  return subscription.disabled ? STATES.DISABLED : STATES.ENABLED;
}

/**
 * Records the latest state of a subscription and the reason for it.
 * @ignore
 * @param {Subscription} subscription The subscription being changed.
 * @param {string} state One of `STATES`.
 * @param {string} [reason] One of `REASONS`. Anything else is recorded as
 *   `REASONS.UNKNOWN`.
 * @returns {Promise}
 */
export async function record(subscription, state, reason) {
  if (!(subscription instanceof RegularSubscription)) {
    return;
  }

  try {
    let entries = await ledger.getStateLoaded();
    entries[subscription.url] = {
      state,
      reason: KNOWN_REASONS.has(reason) ? reason : REASONS.UNKNOWN,
      ts: Date.now()
    };
    await ledger.save();
  }
  catch (e) {
    sentry.reportError(e);
  }
}

/**
 * Returns the recorded state of all subscriptions, keyed by URL.
 * @ignore
 * @returns {Promise<Object<string, {state: string, reason: string,
 *   ts: number}>>}
 */
export async function getEntries() {
  return {...await ledger.getStateLoaded()};
}

async function seed() {
  let entries = await ledger.getStateLoaded();
  if (Object.keys(entries).length > 0) {
    return;
  }

  let subscriptions = [];
  for (let subscription of filterEngine.filterStorage.subscriptions()) {
    if (subscription instanceof RegularSubscription) {
      subscriptions.push(subscription);
    }
  }

  if (subscriptions.length === 0) {
    return;
  }

  let ts = Date.now();
  for (let subscription of subscriptions) {
    entries[subscription.url] = {
      state: getState(subscription),
      reason: REASONS.SNAPSHOT,
      ts
    };
  }
  await ledger.save();
}

/**
 * Records a subscription being replaced by the one its server redirected
 * it to.
 * @ignore
 * @param {Subscription} oldSubscription The subscription that was replaced.
 * @param {Subscription} newSubscription The subscription it was replaced with.
 * @returns {Promise}
 */
export async function recordRedirect(oldSubscription, newSubscription) {
  await record(oldSubscription, STATES.REMOVED, REASONS.REDIRECT);

  // A subscription whose server is gone gets redirected to a data: URL
  // holding its entire filter text, which is neither a subscription to
  // restore nor something to keep in storage.
  if (/^https?:/i.test(newSubscription.url)) {
    await record(
      newSubscription,
      getState(newSubscription),
      REASONS.REDIRECT
    );
  }
}

/**
 * Starts recording redirected subscriptions and writes a snapshot of the
 * current subscriptions if nothing has been recorded yet.
 * @ignore
 * @returns {Promise}
 */
export async function start() {
  if (started) {
    return;
  }
  started = true;

  filterNotifier.on(
    "subscription.redirected",
    (oldSubscription, newSubscription) => {
      void recordRedirect(oldSubscription, newSubscription);
    }
  );

  try {
    await seed();
  }
  catch (e) {
    sentry.reportError(e);
  }
}

/**
 * @ignore
 * @returns {Promise}
 */
export async function reset() {
  ledger.clearState();
  await ledger.save();
}

/**
 * @ignore
 * @returns {Promise}
 */
export async function seedForTesting() {
  await seed();
}
