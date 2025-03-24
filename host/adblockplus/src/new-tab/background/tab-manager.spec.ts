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

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import {
  compareNewTabRequestsByPriority,
  isCoolDownPeriodOngoing
} from "./tab-manager";
import { newTabRequests } from "./tab-manager.spec-data";
import { coolDownPeriodKey, lastShownKey } from "./tab-manager.types";

describe("TabManager", () => {
  describe("compareNewTabRequestsByPriority", () => {
    it("should return -1 if only the first tab has the force method", () => {
      let result = compareNewTabRequestsByPriority(
        newTabRequests[0],
        newTabRequests[2]
      );
      expect(result).toBe(-1);

      result = compareNewTabRequestsByPriority(
        newTabRequests[1],
        newTabRequests[3]
      );
      expect(result).toBe(-1);
    });

    it("should return 1 if only the second tab has the force method", () => {
      let result = compareNewTabRequestsByPriority(
        newTabRequests[2],
        newTabRequests[0]
      );
      expect(result).toBe(1);

      result = compareNewTabRequestsByPriority(
        newTabRequests[3],
        newTabRequests[1]
      );
      expect(result).toBe(1);
    });

    it("should return -1 if the first tab has a higher priority number", () => {
      let result = compareNewTabRequestsByPriority(
        newTabRequests[0],
        newTabRequests[1]
      );
      expect(result).toBe(-1);

      result = compareNewTabRequestsByPriority(
        newTabRequests[2],
        newTabRequests[3]
      );
      expect(result).toBe(-1);
    });

    it("should return 1 if the second tab has a higher priority number", () => {
      let result = compareNewTabRequestsByPriority(
        newTabRequests[1],
        newTabRequests[0]
      );
      expect(result).toBe(1);

      result = compareNewTabRequestsByPriority(
        newTabRequests[3],
        newTabRequests[2]
      );
      expect(result).toBe(1);
    });

    it("should return -1 if the first tab has a lower ipm ID", () => {
      const result = compareNewTabRequestsByPriority(
        newTabRequests[3],
        newTabRequests[4]
      );
      expect(result).toBe(-1);
    });

    it("should return 1 if the second tab has a lower ipm ID", () => {
      const result = compareNewTabRequestsByPriority(
        newTabRequests[4],
        newTabRequests[3]
      );
      expect(result).toBe(1);
    });

    it("should return 0 if the tab have identical methods, priority and ipm ID", () => {
      const result = compareNewTabRequestsByPriority(
        newTabRequests[5],
        newTabRequests[5]
      );
      expect(result).toBe(0);
    });
  });

  describe("isCoolDownPeriodOngoing", () => {
    it("should return true if the cool down period is still ongoing", async () => {
      jest.spyOn(Prefs, "get").mockImplementation((preference) => {
        switch (preference) {
          case lastShownKey:
            return Date.now();
          case coolDownPeriodKey:
            return 24 * 60 * 60 * 1000;
        }
      });

      const result = await isCoolDownPeriodOngoing();
      expect(result).toBe(true);
    });

    it("should return false if the cool down period has ended", async () => {
      jest.spyOn(Prefs, "get").mockImplementation((preference) => {
        switch (preference) {
          case lastShownKey:
            return 0;
          case coolDownPeriodKey:
            return 24 * 60 * 60 * 1000;
        }
      });

      const result = await isCoolDownPeriodOngoing();
      expect(result).toBe(false);
    });
  });
});
