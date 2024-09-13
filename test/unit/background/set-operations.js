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

/* eslint-disable no-multi-spaces */
/* eslint-disable array-bracket-spacing */

import expect from "expect";
import {arraysDiff, filtersUpdateDiff, mergeObjects}
  from "../../../sdk/background/set-operations.js";

describe("Arrays diff", function() {
  it("returns empty", function() {
    const from = [];
    const to = [];
    expect(arraysDiff(from, to)).toEqual({
      added: [],
      removed: []
    });
  });

  it("returns removed", function() {
    const from = ["1", "2", "3"];
    const to = [];
    expect(arraysDiff(from, to)).toEqual({
      added: [],
      removed: ["1", "2", "3"]
    });
  });

  it("returns added", function() {
    const from = [];
    const to = ["1", "2", "3"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["1", "2", "3"],
      removed: []
    });
  });

  it("returns added and removed", function() {
    const from = ["1", "2", "4",     "7"];
    const to = [     "2", "4", "5"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["5"],
      removed: ["1", "7"]
    });
  });

  it("returns added and multiple removed", function() {
    const from = ["1", "2", "4",          "7"];
    const to = [     "2", "4", "5", "6"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["5", "6"],
      removed: ["1", "7"]
    });
  });

  it("returns multiple added and removed", function() {
    const from = ["1", "2", "4",     "7", "8"];
    const to = [     "2", "4", "5"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["5"],
      removed: ["1", "7", "8"]
    });
  });

  it("returns multiple added and multiple removed", function() {
    const from = ["1",      "3",     "5"];
    const to = [     "2",      "4"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["2", "4"],
      removed: ["1", "3", "5"]
    });
  });

  it("returns multiple sequenced added and multiple sequenced removed", function() {
    const from = ["1", "2",          "5", "6"];
    const to = [          "3", "4"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["3", "4"],
      removed: ["1", "2", "5", "6"]
    });
  });

  it("returns no difference", function() {
    const noDiff = {
      added: [],
      removed: []
    };
    expect(arraysDiff(["1"], ["1"])).toEqual(noDiff);
    expect(arraysDiff(["1", "2"], ["1", "2"])).toEqual(noDiff);
  });

  it("ignores duplicates", function() {
    expect(arraysDiff(["1"], ["1", "1"])).toEqual({
      added: [],
      removed: []
    });
    expect(arraysDiff(["1", "1"], ["1"])).toEqual({
      added: [],
      removed: []
    });
    expect(arraysDiff(["1", "1", "2"], ["1", "2", "2"])).toEqual({
      added: [],
      removed: []
    });
  });

  it("does not require the array to be sorted", function() {
    let from = ["3", "1", "4", "5", "2"];
    let to = ["4", "2", "5", "1", "3"];
    expect(arraysDiff(from, to)).toEqual({
      added: [],
      removed: []
    });

    from = ["3", "4", "5", "2"];
    to = ["4", "2", "1", "3"];
    expect(arraysDiff(from, to)).toEqual({
      added: ["1"],
      removed: ["5"]
    });
  });
});

describe("DNR filter diff updates", function() {
  it("properly generate a diff between base and update", function() {
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

    let diff = filtersUpdateDiff(BASE, UPDATE);
    expect(diff.added).toEqual(expect.arrayContaining(["D", "U"]));
    expect(diff.removed).toEqual(expect.arrayContaining(["C", "V"]));
  });
});

describe("Objects merging", function() {
  it("properly merges the loaded and new sitekeys", async function() {
    let obj1 =
      {1: {2: {url1: {sitekey: "sitekey1", signature: "signature1"}}}};
    let obj1PlusTabId =
       {1: {3: {url1: {sitekey: "sitekey2", signature: "signature2"}}},
        4: {5: {url1: {sitekey: "sitekey3", signature: "signature3"}}}};
    expect(await mergeObjects(obj1, obj1PlusTabId)).toEqual({
      1: {
        2: {url1: {sitekey: "sitekey1", signature: "signature1"}},
        3: {url1: {sitekey: "sitekey2", signature: "signature2"}}
      },
      4: {
        5: {url1: {sitekey: "sitekey3", signature: "signature3"}}
      }
    });

    let obj2 =
      {1: {2: {url1: {sitekey: "sitekey1", signature: "signature1"}}}};
    let obj2PlusUrl =
      {1: {2: {url2: {sitekey: "sitekey2", signature: "signature2"}}}};
    expect(await mergeObjects(obj2, obj2PlusUrl)).toEqual({
      1: {
        2: {
          url1: {sitekey: "sitekey1", signature: "signature1"},
          url2: {sitekey: "sitekey2", signature: "signature2"}
        }
      }
    });

    let obj3 =
      {1: {2: {url: {sitekey: "sitekey1", signature: "signature1"}}}};
    let obj3Clone =
      {1: {2: {url: {sitekey: "sitekey1", signature: "signature1"}}}};
    expect(await mergeObjects(obj3, obj3Clone)).toEqual({
      1: {2: {url: {sitekey: "sitekey1", signature: "signature1"}}}
    });
  });

  it("merges saved deferred and runtime deferred messages", function() {
    const message = {
      type: "type",
      content: "content1"
    };

    const savedMessages = {
      1: {
        0: [message]
      },
      2: {
        3: [message]
      }
    };

    const message2 = {
      type: "type",
      content: "content2"
    };

    const runtimeMessages = {
      1: {
        0: [message2],
        3: [message, message2]
      },
      4: {
        5: [message2]
      }
    };

    expect(mergeObjects(savedMessages, runtimeMessages)).toEqual({
      1: {
        0: [message, message2],
        3: [message, message2]
      },
      2: {
        3: [message]
      },
      4: {
        5: [message2]
      }
    });
  });
});
