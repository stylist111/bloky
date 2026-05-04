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

import { describe, expect, it } from "vitest";
import { findFlagByPrefix } from "../../src/background/flags";

describe("findFlagByPrefix", () => {
  it("returns null when no flag matches the prefix", () => {
    const flags = { "other-flag-a": true, "another-b": 42 };
    expect(findFlagByPrefix(flags, "show-reverse-trial-opd-")).toBeNull();
  });

  it("returns the value of the matching flag", () => {
    const flags = { "show-reverse-trial-opd-trialA": true };
    expect(findFlagByPrefix(flags, "show-reverse-trial-opd-")).toBe(true);
  });

  it("returns the config object for the config prefix", () => {
    const config = { trialDurationDays: 14, steps: [] };
    const flags = { "reverse-trial-opd-config-trialA": config };
    expect(findFlagByPrefix(flags, "reverse-trial-opd-config-")).toBe(config);
  });

  it("returns the lexicographically-first match when multiple flags share the prefix", () => {
    // Should never happen in production — the remote-config validator
    // enforces unique flag names. Covered defensively so every
    // extension resolves the same value if a stray duplicate slips
    // through.
    const flags = {
      "show-reverse-trial-opd-z": "z-value",
      "show-reverse-trial-opd-a": "a-value",
      "show-reverse-trial-opd-m": "m-value",
    };
    expect(findFlagByPrefix(flags, "show-reverse-trial-opd-")).toBe("a-value");
  });

  it("does not match a flag whose name equals the prefix without a trailing id", () => {
    const flags = { "show-reverse-trial-opd": true };
    expect(findFlagByPrefix(flags, "show-reverse-trial-opd-")).toBeNull();
  });

  it("does not match flags that only contain the prefix as a substring", () => {
    const flags = { "other-show-reverse-trial-opd-trialA": true };
    expect(findFlagByPrefix(flags, "show-reverse-trial-opd-")).toBeNull();
  });

  it("returns null for an empty flags record", () => {
    expect(findFlagByPrefix({}, "show-reverse-trial-opd-")).toBeNull();
  });
});
