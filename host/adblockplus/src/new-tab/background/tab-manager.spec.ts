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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { type Management } from "webextension-polyfill";

import {
  addCohortAssignmentsSearchParam,
  addExperimentsSearchParams,
  createSafeOriginUrl,
  getBehavior,
  getCommand,
  isCommandExpired
} from "@eyeo-fragments/in-product-messaging/background";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { CreationMethod } from "./middleware";
import {
  buildTargetUrl,
  compareNewTabRequestsByPriority,
  handleCommand,
  isCoolDownPeriodOngoing,
  queueOpenNewTab
} from "./tab-manager";
import { newTabRequests } from "./tab-manager.spec-data";
import { coolDownPeriodKey, lastShownKey } from "./tab-manager.types";

jest.mock("@eyeo-fragments/in-product-messaging/background", () => ({
  addCohortAssignmentsSearchParam: jest.fn(),
  addExperimentsSearchParams: jest.fn(),
  createSafeOriginUrl: jest.fn(),
  dismissCommand: jest.fn(),
  getBehavior: jest.fn(),
  getCommand: jest.fn(),
  isCommandExpired: jest.fn()
}));

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

  describe("buildTargetUrl", () => {
    const targetUrl = "http://example.com";
    const urlWithExperiments = "http://example.com?ev=__exp__&er=__rev__";

    it("should pass the experiment-modified URL to addCohortAssignmentsSearchParam", async () => {
      jest
        .mocked(addExperimentsSearchParams)
        .mockResolvedValue(urlWithExperiments);
      const mockAddCohortAssignmentsSearchParam = jest
        .mocked(addCohortAssignmentsSearchParam)
        .mockResolvedValue(`${urlWithExperiments}&ca=__ca__`);

      await buildTargetUrl(targetUrl);

      expect(mockAddCohortAssignmentsSearchParam).toHaveBeenCalledWith(
        urlWithExperiments
      );
    });
  });

  describe("queueOpenNewTab", () => {
    const ipmId = "queue-test";

    beforeEach(async () => {
      jest.spyOn(browser.management, "getSelf").mockResolvedValue({
        id: "self",
        installType: "normal"
      } as unknown as Management.ExtensionInfo);
      jest.spyOn(Prefs, "get").mockImplementation((preference) => {
        if (preference === "suppress_first_run_page") {
          return false;
        }
        // Both 0 so that the cool down period is never ongoing.
        if (preference === lastShownKey || preference === coolDownPeriodKey) {
          return 0;
        }
      });
      jest.spyOn(Prefs, "set").mockResolvedValue(undefined);
      // `ewe.notifications` is a Proxy that re-wraps this method on every
      // access, so `jest.spyOn` can't intercept it. Overriding the
      // underlying property directly still works because the proxy's
      // wrapper delegates to it.
      Object.defineProperty(ewe.notifications, "getIgnoredCategories", {
        value: jest.fn().mockResolvedValue([]),
        configurable: true,
        writable: true
      });

      jest.mocked(getBehavior).mockReturnValue({
        target: "https://example.com",
        method: CreationMethod.force,
        priority: 1
      });
      jest.mocked(createSafeOriginUrl).mockReturnValue("https://example.com");
      jest.mocked(addExperimentsSearchParams).mockResolvedValue(null);
      jest.mocked(addCohortAssignmentsSearchParam).mockResolvedValue(null);
      jest.mocked(getCommand).mockReturnValue({
        command_name: "create_tab",
        version: 1,
        payload: {}
      } as unknown as ReturnType<typeof getCommand>);
      jest.mocked(isCommandExpired).mockReturnValue(false);
      jest.spyOn(browser.tabs, "create").mockResolvedValue({
        id: 1,
        index: 0,
        highlighted: false,
        active: false,
        pinned: false,
        incognito: false
      });

      // `force` commands are picked up immediately without registering
      // tab event listeners, keeping this test focused on the queue.
      await handleCommand(ipmId);
    });

    it("only opens one tab when triggered concurrently", async () => {
      // Simulates the race between concurrent triggers (e.g. tab events and
      // processed IPM commands) that used to be able to open the same
      // waiting candidate's tab more than once.
      await Promise.all([queueOpenNewTab(), queueOpenNewTab()]);

      /* eslint-disable-next-line @typescript-eslint/unbound-method */
      expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    });
  });
});
