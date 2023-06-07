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
import {calculateDiff} from "../../sdk/api/filter-diffs.js";

describe("DNR diff updates", function() {
  it("properly generate a diff between base and update", function() {
    const BASE = {
      type: "diff",
      added: [
        "A", "B", "C"
      ],
      removed: [
        "T", "U"
      ]
    };
    const UPDATE = {
      type: "diff",
      added: [
        "A", "B", "D"
      ],
      removed: [
        "T", "V"
      ]
    };

    let diff = calculateDiff(BASE, UPDATE);
    expect(diff.added).toEqual(expect.arrayContaining(["D", "U"]));
    expect(diff.removed).toEqual(expect.arrayContaining(["C", "V"]));
  });

  it("throw if the diffs are the wrong type", function() {
    const BASE = {
      added: [
        "A", "B", "C"
      ],
      removed: [
        "T", "U"
      ]
    };
    const UPDATE = {
      added: [
        "A", "B", "D"
      ],
      removed: [
        "T", "V"
      ]
    };

    expect(() => calculateDiff(BASE, UPDATE)).toThrow("Invalid FilterDiffs type");
  });
});
