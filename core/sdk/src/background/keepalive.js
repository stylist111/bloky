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
import {MILLIS_IN_SECOND, MILLIS_IN_MINUTE} from "#adblockpluscore/lib/time.js";

/**
 * @file Keeps the MV3 background service worker alive for the duration of
 * a long-running operation, such as adding default subscriptions or
 * downloading a filter list.
 *
 * Chrome resets a service worker's idle timer when it receives an event or
 * calls an extension API, but not for other pending async work (e.g. a
 * fetch() response that takes a while to arrive). Without this, a
 * long-running operation risks the worker being terminated part way
 * through, which can leave subscriptions partially added or updated.
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
 */

// Comfortably under Chrome's 30 second service worker idle timeout.
const PING_INTERVAL_MILLIS = 20 * MILLIS_IN_SECOND;

// Safety net: longer than any real operation this is used to guard should
// take, so that a caller whose operation never finishes and never calls stop()
// can't keep pinging and keep the service worker alive forever.
const MAX_LIFETIME_MILLIS = 10 * MILLIS_IN_MINUTE;

// An unlikely-to-collide key - only used to make an extension API call,
// the result (and whether anything is stored under it) doesn't matter.
const PING_STORAGE_KEY = "__ewe_keepalive_ping";

let refCount = 0;
let intervalId = null;

function isMV3() {
  return browser.runtime.getManifest().manifest_version === 3;
}

function ping() {
  // A cheap, side-effect free extension API call - only its side effect of
  // resetting the service worker's idle timer matters, not its result.
  browser.storage.local.get(PING_STORAGE_KEY).catch(() => {});
}

/**
 * Signals that a long-running operation has started, keeping the background
 * service worker alive (on MV3 only) until every caller has signalled that
 * its operation has finished. Reference counted, so overlapping
 * operations are supported.
 * @param {function} [onStopped] Called once this particular signal actually
 *   stops - whether because the returned function was called, or because
 *   the MAX_LIFETIME_MILLIS safety net triggered it on its own. Useful for
 *   a caller that needs to know this happened even if it never called the
 *   returned function itself.
 * @return {function} Call once the operation has finished.
 */
export function keepAlive(onStopped) {
  if (!isMV3()) {
    return () => {};
  }

  refCount++;
  if (intervalId === null) {
    // setInterval() only fires after the first PING_INTERVAL_MILLIS elapses,
    // but we don't know how long it's already been since the last event or
    // API call reset the idle timer before this call - ping right away too,
    // so a newly-started operation is covered from the outset rather than
    // trusting that the timer was reset recently enough on its own.
    ping();
    intervalId = setInterval(ping, PING_INTERVAL_MILLIS);
  }

  let done = false;
  const stop = function stop() {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(maxLifetimeId);

    refCount--;
    if (refCount <= 0) {
      refCount = 0;
      clearInterval(intervalId);
      intervalId = null;
    }

    if (onStopped) {
      onStopped();
    }
  };

  const maxLifetimeId = setTimeout(stop, MAX_LIFETIME_MILLIS);

  return stop;
}

/**
 * Runs an async function while keeping the background service worker alive.
 * @param {function} fn
 * @return {Promise} Resolves or rejects with whatever `fn` does.
 */
export async function withKeepAlive(fn) {
  let stop = keepAlive();
  try {
    return await fn();
  }
  finally {
    stop();
  }
}
