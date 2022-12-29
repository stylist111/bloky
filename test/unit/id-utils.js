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
import {encode, decode, INDEX_MAX} from "../../sdk/api/id-utils.js";

describe("ID utils", function() {
  const INT_RULE_ID_MAX = Math.pow(2, 31) - 1;

  function assertEncodeDecode(index, line) {
    let ruleId = encode(index, line);
    // Chromium requirement:
    // https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
    expect(ruleId >= 1 && ruleId <= INT_RULE_ID_MAX).toEqual(true);

    let decoded = decode(ruleId);
    expect(decoded.index).toEqual(index);
    expect(decoded.line).toEqual(line);
  }

  it("encode/decode rule index and line number to/from rule id", function() {
    const INT_8BIT_MAX = 0xFF;
    // additional `- 1` as we have to start from 1 and we add it while encoding
    const LINE_MAX = Math.floor(INT_RULE_ID_MAX / INDEX_MAX) - 1;

    for (let ruleIndex of [0, INT_8BIT_MAX, INDEX_MAX - 1]) {
      for (let lineNumber of [0, INT_8BIT_MAX, INDEX_MAX, LINE_MAX])
        assertEncodeDecode(ruleIndex, lineNumber);
    }
  });
});


