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

import expect from "expect";
import {
  olderThan,
  semverGreaterThan,
  semverGreaterThanInclusive,
  semverLessThan,
  semverLessThanInclusive,
  withinLast
} from "../../../src/background/cohorts/operators.js";

describe("Cohorts Operators", function() {
  describe("Date Operators", function() {
    it("olderThan", function() {
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const date1 = new Date(2025, 5, 1); // June 1, 2025
      const date2 = new Date(2025, 5, 2); // June 2, 2025
      const fiveDays = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
      expect(olderThan(now, 1000)).toBe(false);
      expect(olderThan(oneSecondAgo, 0)).toBe(true);
      expect(olderThan(now, fiveDays)).toBe(false);
      expect(olderThan(date1, fiveDays)).toBe(true);
      expect(olderThan(date2, fiveDays)).toBe(true);
    });

    it("withinLast", function() {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
      const fiveDays = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
      const sixDaysAgo =
        Date.now() - 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds
      expect(withinLast(yesterday, fiveDays)).toBe(true);
      expect(withinLast(sixDaysAgo, fiveDays)).toBe(false);
    });
  });

  describe("Semver Operators", function() {
    it("semverGreaterThan", function() {
      expect(semverGreaterThan("1.2.3", "1.2.2")).toBe(true);
      expect(semverGreaterThan("1.2.3", "1.1.1")).toBe(true);
      expect(semverGreaterThan("1.2.3", "1.2.3")).toBe(false);
      expect(semverGreaterThan("1.2.3", "1.2.4")).toBe(false);
    });

    it("semverGreaterThanInclusive", function() {
      expect(semverGreaterThanInclusive("1.2.3", "1.2.2")).toBe(true);
      expect(semverGreaterThanInclusive("1.2.3", "1.2.3")).toBe(true);
      expect(semverGreaterThanInclusive("1.2.3", "1.2.4")).toBe(false);
      expect(semverGreaterThanInclusive("1.2.3", "4.1.2")).toBe(false);
    });

    it("semverLessThan", function() {
      expect(semverLessThan("1.2.3", "1.2.2")).toBe(false);
      expect(semverLessThan("1.2.3", "1.2.3")).toBe(false);
      expect(semverLessThan("1.2.3", "1.2.4")).toBe(true);
      expect(semverLessThan("1.2.3", "2.5.2")).toBe(true);
    });

    it("semverLessThanInclusive", function() {
      expect(semverLessThanInclusive("1.2.3", "1.2.2")).toBe(false);
      expect(semverLessThanInclusive("1.2.3", "1.1.2")).toBe(false);
      expect(semverLessThanInclusive("1.2.3", "1.2.3")).toBe(true);
      expect(semverLessThanInclusive("1.2.3", "1.2.4")).toBe(true);
    });
  });
});
