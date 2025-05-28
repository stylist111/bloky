/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable @typescript-eslint/unbound-method */
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getIPMPingCount } from "./ping-count";
import { pingCountPrefsKey } from "./telemetry.types";

describe("ping-count", () => {
  describe("getIPMPingCount", () => {
    it("should query Prefs.get with the correct storage key", async () => {
      jest.spyOn(Prefs, "get");
      await getIPMPingCount();
      expect(Prefs.get).toHaveBeenCalledTimes(1);
      expect(Prefs.get).toHaveBeenCalledWith(pingCountPrefsKey);
    });

    it("should forward the number that Prefs.get returns", async () => {
      const value = 4;
      jest.spyOn(Prefs, "get").mockReturnValue(value);
      const result = await getIPMPingCount();
      expect(Prefs.get).toHaveBeenCalledTimes(1);
      expect(result).toBe(value);
    });
  });
});
