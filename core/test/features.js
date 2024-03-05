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

"use strict";

const assert = require("assert");
const {LIB_FOLDER} = require("./_common");

const {resetFeatureFlags, setFeatureFlags, isFeatureEnabled} =
      require(LIB_FOLDER + "/features");

describe("Features", function() {
  const FEATURE = "example";
  const INVALID_FEATURE = "thisFeatureDoesNotExist";
  const INVALID_FEATURE_2 = "thisFeatureAlsoDoesNotExist";

  afterEach(function() {
    resetFeatureFlags();
  });

  it("returns the default state of a flag", function() {
    // This test must be first, otherwise it's going to get the value from the
    // flags being reset in afterEach, rather than the actual default value.
    assert.equal(isFeatureEnabled(FEATURE), false);
  });

  it("throws an error when retrieving the value for a flag which does not exist", function() {
    assert.throws(() => isFeatureEnabled(INVALID_FEATURE),
                  new Error(`Unknown feature flag: ${INVALID_FEATURE}`));
  });

  it("returns the new value if a flag is set", function() {
    setFeatureFlags({[FEATURE]: true});
    assert.equal(isFeatureEnabled(FEATURE), true);
  });

  it("returns a list of unknown features when setting the base values, while still setting valid flags", function() {
    assert.throws(
      () => setFeatureFlags({
        [FEATURE]: true,
        [INVALID_FEATURE]: false,
        [INVALID_FEATURE_2]: true
      }),
      new Error(`Unknown feature flags: ${INVALID_FEATURE}, ${INVALID_FEATURE_2}`)
    );

    assert.equal(isFeatureEnabled(FEATURE), true);
  });
});
