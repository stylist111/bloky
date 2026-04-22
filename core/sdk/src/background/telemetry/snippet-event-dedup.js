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

import {MILLIS_IN_MINUTE} from "#adblockpluscore/lib/time.js";

let dedupWindowMs = 5 * MILLIS_IN_MINUTE;
const seen = new Map();

/**
 * Check whether a snippet detection event is a duplicate.
 * Records the event if it is new; returns true (duplicate) if the
 * same (type, domain) was seen within the de-duplication window.
 * Stale entries are cleaned up lazily on each call. The Map resets
 * when the MV3 service worker restarts.
 *
 * @param {string} type Detection type identifier (e.g. "adshield-script")
 * @param {string} domain Normalised top-level domain
 * @returns {boolean} true if duplicate (caller should drop), false if new
 */
export function isSnippetEventDuplicate(type, domain) {
  const key = `${type}:${domain}`;
  const now = Date.now();

  // Remove expired entries first so any surviving key
  // is guaranteed to be within the dedup window
  pruneStaleEntries(now);

  // If the key survived pruning, it's a recent duplicate
  if (seen.has(key)) {
    return true;
  }

  seen.set(key, now);
  return false;
}

/**
 * Remove entries older than the de-duplication window.
 * Called lazily from isSnippetEventDuplicate so the Map
 * doesn't accumulate stale keys across long-lived sessions.
 *
 * @param {number} now Current timestamp (Date.now())
 */
function pruneStaleEntries(now) {
  for (const [k, ts] of seen) {
    if (now - ts >= dedupWindowMs) {
      seen.delete(k);
    }
  }
}

/**
 * Clear all de-duplication state. Used in tests to reset between
 * test cases.
 */
export function clearDedupState() {
  seen.clear();
}

/**
 * Override the de-duplication window duration. Used in integration
 * tests to avoid waiting 5 minutes for expiry.
 * @param {number} ms Window duration in milliseconds
 */
export function setDedupWindowForTesting(ms) {
  dedupWindowMs = ms;
}

/**
 * Restore the default 5-minute de-duplication window.
 */
export function restoreDedupWindow() {
  dedupWindowMs = 5 * MILLIS_IN_MINUTE;
}
