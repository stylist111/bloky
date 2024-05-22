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

import {filterEngine} from "./core.js";
import * as frameState from "./frame-state.js";
import {IO as io} from "./io.js";
import {init as initDNRFilters} from "./dnr-filters.js";
import {init as initPrefs} from "./prefs.js";
import {default as debugging} from "./debugging.js";
import * as cdp from "./cdp.js";

let startupPromise;

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
   * @return {Promise} Resolves when initialization is complete
   */
  start() {
    if (!startupPromise) {
      startupPromise = (async() => {
        await io.initialize();
        await debugging.start();
        await initPrefs();
        await filterEngine.initialize();
        await frameState.start();
        await initDNRFilters();
        await cdp.start();
      })();
    }
    return startupPromise;
  }
};
