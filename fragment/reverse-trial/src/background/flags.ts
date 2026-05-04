/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Returns the value of the first flag in `flags` whose name starts with
 * `prefix`, or `null` if no such flag exists. `prefix` is expected to
 * include its trailing `-` separator (e.g. `"show-reverse-trial-opd-"`).
 *
 * Each remote reverse-trial experiment appends its own identifier to
 * the base flag name so the experiments framework (which rejects
 * duplicate flag names across experiments) accepts multiple concurrent
 * variants. The runtime scans for any flag matching the base prefix.
 *
 * Multiple matches are impossible by construction: the remote-config
 * validator enforces unique flag names, and product guarantees a user
 * is only ever in one reverse-trial experiment at a time. If two
 * matches somehow appear at runtime, `Object.keys().sort()` ensures
 * every extension picks the same one deterministically.
 */
export function findFlagByPrefix(
  flags: Record<string, unknown>,
  prefix: string,
): unknown {
  for (const name of Object.keys(flags).sort()) {
    if (name.startsWith(prefix)) {
      return flags[name];
    }
  }
  return null;
}
