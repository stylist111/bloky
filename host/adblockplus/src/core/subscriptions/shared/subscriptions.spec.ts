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

import {
  AI_SUMMARIES_FLAG,
  AI_SUMMARIES_SUBSCRIPTION_TYPE,
  compareByNewFreeType,
  isAiSummariesRolledOut,
  isAiSummariesVisible,
  isNewFreeType,
  newFreeTypes
} from "./index";

describe("core/subscriptions/shared", () => {
  describe("newFreeTypes", () => {
    it("contains the AI search summaries filter list", () => {
      expect(AI_SUMMARIES_SUBSCRIPTION_TYPE).toBe("ai-summaries");
      expect(newFreeTypes.has(AI_SUMMARIES_SUBSCRIPTION_TYPE)).toBe(true);
    });

    it("does not contain the other free filter lists", () => {
      for (const type of ["ads", "notifications", "privacy", "social"]) {
        expect(newFreeTypes.has(type)).toBe(false);
      }
    });
  });

  describe("isNewFreeType", () => {
    it("returns true for the AI search summaries filter list", () => {
      expect(isNewFreeType(AI_SUMMARIES_SUBSCRIPTION_TYPE)).toBe(true);
    });

    it("returns false for other filter lists", () => {
      expect(isNewFreeType("notifications")).toBe(false);
      expect(isNewFreeType("circumvention")).toBe(false);
    });

    it("returns false for filter lists without a recommendation type", () => {
      expect(isNewFreeType(undefined)).toBe(false);
      expect(isNewFreeType(null)).toBe(false);
      expect(isNewFreeType("")).toBe(false);
    });
  });

  describe("compareByNewFreeType", () => {
    interface Item {
      recommended?: string;
      url?: string;
    }
    const aiSummaries: Item = { recommended: AI_SUMMARIES_SUBSCRIPTION_TYPE };
    const notifications: Item = { recommended: "notifications" };
    const social: Item = { recommended: "social" };
    const custom: Item = { url: "https://example.com/list.txt" };

    it("sorts a new filter list before an existing one", () => {
      expect(compareByNewFreeType(aiSummaries, notifications)).toBeLessThan(0);
      expect(compareByNewFreeType(notifications, aiSummaries)).toBeGreaterThan(
        0
      );
    });

    it("sorts a new filter list before a custom one", () => {
      expect(compareByNewFreeType(aiSummaries, custom)).toBeLessThan(0);
      expect(compareByNewFreeType(custom, aiSummaries)).toBeGreaterThan(0);
    });

    it("leaves the order of two existing filter lists to other criteria", () => {
      expect(compareByNewFreeType(notifications, social)).toBe(0);
      expect(compareByNewFreeType(social, notifications)).toBe(0);
      expect(compareByNewFreeType(custom, custom)).toBe(0);
    });

    it("leaves the order of two new filter lists to other criteria", () => {
      expect(compareByNewFreeType(aiSummaries, { ...aiSummaries })).toBe(0);
    });

    it("moves new filter lists to the top when used for sorting", () => {
      const items = [notifications, social, aiSummaries, custom];
      items.sort(compareByNewFreeType);

      expect(items[0]).toBe(aiSummaries);
      // The remaining items keep their relative order
      expect(items.slice(1)).toEqual([notifications, social, custom]);
    });
  });

  describe("isAiSummariesRolledOut", () => {
    it("has a stable flag name", () => {
      expect(AI_SUMMARIES_FLAG).toBe("ai-summaries-enabled");
    });

    it("returns false for users outside the experiment", () => {
      expect(isAiSummariesRolledOut({})).toBe(false);
      expect(isAiSummariesRolledOut({ other: true })).toBe(false);
      expect(isAiSummariesRolledOut({ [AI_SUMMARIES_FLAG]: "true" })).toBe(
        false
      );
    });

    it("returns true when the flag is set", () => {
      expect(isAiSummariesRolledOut({ [AI_SUMMARIES_FLAG]: true })).toBe(true);
    });

    it("returns false when the flags are not available", () => {
      expect(isAiSummariesRolledOut(undefined)).toBe(false);
    });
  });

  describe("isAiSummariesVisible", () => {
    it("shows the option to users in the experiment", () => {
      expect(isAiSummariesVisible(true, false)).toBe(true);
    });

    it("hides the option from users outside the experiment", () => {
      expect(isAiSummariesVisible(false, false)).toBe(false);
    });

    it("keeps showing the option to users who turned the list on", () => {
      expect(isAiSummariesVisible(false, true)).toBe(true);
    });
  });
});
