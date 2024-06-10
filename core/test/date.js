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

"use strict";

const assert = require("assert");

const {LIB_FOLDER} = require("./_common");
const {toLocalISODateString, toLocalISODateStringWithCutoffTime} =
      require(LIB_FOLDER + "/date");
const {MINUTES_IN_HOUR} = require(LIB_FOLDER + "/time");

describe("date", function() {
  describe("toLocalISODateString", function() {
    it("formats a date, without the time component", function() {
      assert.equal(
        toLocalISODateString(new Date(2024, 0, 15, 0, 2, 3)),
        "2024-01-15"
      );
    });
  });

  describe("toLocalISODateStringWithCutoffTime", function() {
    it("formats a date that is still on the previous day based on the cutoff", function() {
      assert.equal(
        toLocalISODateStringWithCutoffTime(
          new Date(2022, 3, 11, 12, 2, 3),
          13 * MINUTES_IN_HOUR
        ),
        "2022-04-10"
      );
    });

    it("formats a date that is exactly in the new day", function() {
      assert.equal(
        toLocalISODateStringWithCutoffTime(
          new Date(2022, 3, 11, 12, 2, 0),
          12 * MINUTES_IN_HOUR + 2
        ),
        "2022-04-11"
      );
    });

    it("formats a date that is in the new day", function() {
      assert.equal(
        toLocalISODateStringWithCutoffTime(
          new Date(2022, 3, 11, 12, 2, 0),
          11 * MINUTES_IN_HOUR
        ),
        "2022-04-11"
      );
    });
  });
});
