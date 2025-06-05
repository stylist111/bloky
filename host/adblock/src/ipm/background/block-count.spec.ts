/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { describe, expect, vi } from "vitest";

import { Prefs } from "~/alias/prefs";
import { getBlockCount } from "./block-count";

vi.mock("~/alias/prefs", () => {
  return {
    Prefs: {
      get: vi.fn(),
      untilLoaded: Promise.resolve(),
    },
  };
});

describe("block-count", () => {
  describe("getBlockCount", () => {
    it("should query Prefs.get with the correct storage key", async () => {
      const prefsGet = vi.spyOn(Prefs, "get");
      await getBlockCount();
      expect(prefsGet).toHaveBeenCalledTimes(1);
      expect(prefsGet).toHaveBeenLastCalledWith("blocked_total");
    });

    it("should forward the number that Prefs.get returns", async () => {
      const value = 4;
      const prefsGet = vi.spyOn(Prefs, "get").mockResolvedValue(value);
      const result = await getBlockCount();
      expect(prefsGet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(value);
    });
  });
});
