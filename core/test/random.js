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
const {randomInteger} = require(LIB_FOLDER + "/random");

describe("random", function() {
  describe("randomInteger", function() {
    function checkRandomIntegerIsInRange(min, max) {
      // it's random, so run it a few times to ensure that the property holds
      for (let i = 0; i < 100; ++i) {
        let random = randomInteger(min, max);
        let message = `randomInteger(${min}, ${max}) -> ${random}`;
        assert(random >= min, message);
        assert(random < max, message);
        assert(Number.isInteger(random), message);
      }
    }

    it("should return an integer between 0 and the provided max", function() {
      checkRandomIntegerIsInRange(0, 12345);
    });

    it("should work with a negative minimum", function() {
      checkRandomIntegerIsInRange(-9876, 12);
    });

    it("should work with a negative maxiumum", function() {
      checkRandomIntegerIsInRange(-9876, -1234);
    });

    it("should throw an error if min is more than max", function() {
      assert.throws(
        () => randomInteger(10, 2),
        new Error("Cannot generate random integer in range, min (10) must be less than max (2)")
      );
    });
  });
});
