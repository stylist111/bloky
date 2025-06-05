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

import { getIPMPingCount } from "./ping-count";

describe("ping-count", () => {
  describe("getIPMPingCount", () => {
    it("should query storage with the correct storage key", async () => {
      const storageGet = vi.spyOn(browser.storage.local, "get");
      await getIPMPingCount();
      expect(storageGet).toHaveBeenCalledTimes(1);
      expect(storageGet).toHaveBeenLastCalledWith("total_ipm_pings");
    });

    it("should forward the number that storage returns", async () => {
      const value = 4;
      const storageGet = vi.spyOn(browser.storage.local, "get").mockResolvedValue({
        total_ipm_pings: value,
      });
      const result = await getIPMPingCount();
      expect(storageGet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(value);
    });
  });
});
