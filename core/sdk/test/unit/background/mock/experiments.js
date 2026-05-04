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

// Minimal mock of the experiments namespace for unit tests that only
// need to exercise `getFlag("lightning-snippets-enabled")`. Controlled
// via `global.__lightningSnippetsFlag`, which tests set before invoking
// the module under test.

export default {
  async getFlag(flagId) {
    if (flagId === "lightning-snippets-enabled") {
      return global.__lightningSnippetsFlag ?? null;
    }
    return null;
  }
};
