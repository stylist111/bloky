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

import {PersistentState} from "./persistence.js";
import {default as account} from "./account/index.js";
import {default as experiments} from "./experiments.js";

// Persisted shape: { enabled?: boolean }
//   present & true  -> caller explicitly enabled
//   present & false -> caller explicitly disabled
//   absent          -> no caller opinion (defer to premium / default)
const state = new PersistentState(
  "ewe:lightning-snippets", browser.storage.local
);

const LIGHTNING_SNIPPETS_FLAG = "lightning-snippets-enabled";

let defaultValue = false;

/**
 * Sets the host-provided default. Called synchronously from
 * EWE.start() so defaultValue is populated before any API call can
 * reach isEnabled(). Any non-`true` value (including undefined)
 * resolves to `false`.
 *
 * @ignore
 * @param {boolean} [enabled]
 */
export function initialize(enabled) {
  defaultValue = enabled === true;
}

/**
 * Controls whether Lightning Snippets (zero-delay filter caching)
 * is enabled for this installation.
 *
 * Resolution precedence for `isEnabled()` (highest to lowest):
 *   1. Remote `lightning-snippets-enabled` flag — when set to a
 *      boolean it is authoritative and wins over everything below.
 *      Acts as the remote control for the feature. `null`/absent
 *      falls through.
 *   2. Caller opinion — if `enable()` or `disable()` has been
 *      called, that value wins over premium and default. `disable()`
 *      beats premium status: a premium user the caller has disabled
 *      stays disabled until `clear()`.
 *   3. Premium status — premium accounts are enabled.
 *   4. Default — `addonInfo.lightningSnippets` at the most recent
 *      SDK start.
 *
 * Per-host Lightning activation (via the `zero-delay-snippet-domains`
 * experiment flag) is composed outside this namespace — see the
 * `ewe:get-filters-config` handler. It activates caching for
 * specific hostnames regardless of the state resolved here.
 *
 * @namespace lightningSnippets
 */
export default {
  /**
   * Enables Lightning Snippets. Wins over premium and the default.
   * Idempotent.
   * @function
   * @memberof lightningSnippets
   * @returns {Promise<void>}
   */
  async enable() {
    const s = await state.getStateLoaded();
    if (s.enabled === true) {
      return;
    }
    s.enabled = true;
    await state.save();
  },

  /**
   * Disables Lightning Snippets. Wins over premium and the default —
   * premium users the caller has disabled stay disabled until
   * `clear()`. Idempotent.
   * @function
   * @memberof lightningSnippets
   * @returns {Promise<void>}
   */
  async disable() {
    const s = await state.getStateLoaded();
    if (s.enabled === false) {
      return;
    }
    s.enabled = false;
    await state.save();
  },

  /**
   * Removes the caller opinion. Resolution falls through to premium
   * status, then the default. Idempotent.
   * @function
   * @memberof lightningSnippets
   * @returns {Promise<void>}
   */
  async clear() {
    const s = await state.getStateLoaded();
    if (typeof s.enabled !== "boolean") {
      return;
    }
    delete s.enabled;
    await state.save();
  },

  /**
   * Resolves whether Lightning Snippets is enabled for this
   * installation, per the namespace precedence chain.
   * @function
   * @memberof lightningSnippets
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    const flag = await experiments.getFlag(LIGHTNING_SNIPPETS_FLAG);
    if (typeof flag === "boolean") {
      return flag;
    }
    const s = await state.getStateLoaded();
    if (typeof s.enabled === "boolean") {
      return s.enabled;
    }
    if (await account.hasPremium()) {
      return true;
    }
    return defaultValue;
  }
};
