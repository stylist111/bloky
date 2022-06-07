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

import {filterEngine} from "./index.js";
import * as frameState from "./frame-state.js";
import * as requestFilter from "./request-filter.js";
import * as popupBlocker from "./popup-blocker.js";
import {init as initIDB} from "./idb.js";
import {init as initDNRFilters} from "./dnr-filters.js";

let startupPromise;
let stopped = true;

async function startAsyncModule(start) {
  await start();
  if (stopped)
    throw new Error("Stopped before initialization was finished");
}

export default {
  /**
   * Initializes stateful modules that may be used in filtering requests.
   *
   * This function is idempotent. If you call it after initialization
   * has already been launched elsewhere, then it will return the same
   * promise as the original initialization. This allows this function
   * to be called anywhere that you need to ensure that initialization
   * has completed before continuing.
   *
   * Calling this function is required for the other API calls to
   * work, except for API event listener calls, which could also be
   * done before `start()`.
   *
   * The returned promise is rejected if {@link #stop|stop()} is
   * called before it completes.
   * @return {Promise} Resolves when initialization is complete
   * @see {@link #stop|stop()}
   */
  start() {
    if (!startupPromise) {
      startupPromise = (async() => {
        stopped = false;
        await startAsyncModule(() => initIDB());
        await startAsyncModule(() => filterEngine.initialize());
        await startAsyncModule(() => frameState.start());
        requestFilter.start();
        popupBlocker.start();
        await startAsyncModule(() => initDNRFilters());
      })();
    }
    return startupPromise;
  },

  /**
   * Stops blocking any content and uninitializes stateful modules
   * used in filtering requests.
   */
  stop() {
    stopped = true;
    startupPromise = null;
    frameState.stop();
    requestFilter.stop();
    popupBlocker.stop();
  },

  isStarted() {
    return !stopped;
  }
};
