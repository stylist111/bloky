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
import {MaxLengthMetricsDict} from "../../../sdk/background/domains-trimming.js";

const SESSIONS_COUNT = "sessions_count";
const PAGE_VIEWS = "page_views";

describe("Domains trimming", function() {
  it("serializes empty dictionary", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT]);
    const expected = "[]";
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("formats according to passed 'space' argument", function() {
    function assertFormatted(space, expected) {
      const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], space);
      fsmd.addMetric("domain1.com", SESSIONS_COUNT, 0);
      expect(fsmd.serialize()).toEqual(expected);
      expect(fsmd.getLength()).toEqual(expected.length);
    }

    const noIndentationString = "[{\"site_id\":\"domain1.com\",\"sessions_count\":0}]";
    assertFormatted(null, noIndentationString);
    assertFormatted(0, noIndentationString);
    assertFormatted("", noIndentationString);

    const singleSpaceIndentationString =
`[
 {
  "site_id": "domain1.com",
  "sessions_count": 0
 }
]`;
    assertFormatted(1, singleSpaceIndentationString);
    assertFormatted(" ", singleSpaceIndentationString);
    assertFormatted("\t",
`[
\t{
\t\t"site_id": "domain1.com",
\t\t"sessions_count": 0
\t}
]`);
    const doubleSpaceIndentationString =
`[
  {
    "site_id": "domain1.com",
    "sessions_count": 0
  }
]`;
    assertFormatted(2, doubleSpaceIndentationString);
    assertFormatted("  ", doubleSpaceIndentationString);

    const fourSpacesIndentationString =
`[
    {
        "site_id": "domain1.com",
        "sessions_count": 0
    }
]`;
    assertFormatted(4, fourSpacesIndentationString);
    assertFormatted("    ", fourSpacesIndentationString);
  });

  it("adds a domain separately if does not exceed the limit", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "domain.com",
    "sessions_count": 1
  }
]`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("adds a domain separately if does not exceed the limit with multiple metrics", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT, PAGE_VIEWS]);
    const expected =
`[
  {
    "site_id": "domain.com",
    "sessions_count": 1,
    "page_views": 0
  }
]`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit", function() {
    const fsmd = new MaxLengthMetricsDict(50, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "UNKNOWN",
    "sessions_count": 1
  }
]`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("always trims long domains", function() {
    // trims all the domains longer than 25 characters,
    // even if it fits into the payload limit
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "UNKNOWN",
    "sessions_count": 1
  }
]`;
    fsmd.addMetric("alongdomainthatexceedsthe25charslimit.com", SESSIONS_COUNT, 1);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);

    fsmd.addMetric("someotherlongdomainthatexceedsthe25charslimit.com", SESSIONS_COUNT, 2);
    const expected2 =
`[
  {
    "site_id": "UNKNOWN",
    "sessions_count": 3
  }
]`;
    expect(fsmd.serialize()).toEqual(expected2);
    expect(fsmd.getLength()).toEqual(expected2.length);
  });

  it("trims all the domains if exceeds the limit", function() {
    const fsmd = new MaxLengthMetricsDict(50, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "UNKNOWN",
    "sessions_count": 3
  }
]`;
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "domain1.com",
    "sessions_count": 1
  },
  {
    "site_id": "UNKNOWN",
    "sessions_count": 2
  }
]`;
    // does not exceed, thus added separately
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    // exceeds, thus added as unknown
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("does not trim for existing only metrics even if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT]);
    const expected =
`[
  {
    "site_id": "domain1.com",
    "sessions_count": 4
  },
  {
    "site_id": "UNKNOWN",
    "sessions_count": 2
  }
]`;
    // does not exceed, thus added separately
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    // exceeds, thus added as unknown
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    // still exceeds, but updates the value for existing property
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 3);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("does not trim for existing multiple metrics even if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(150, [SESSIONS_COUNT, PAGE_VIEWS]);
    const expected =
`[
  {
    "site_id": "domain1.com",
    "sessions_count": 1,
    "page_views": 2
  },
  {
    "site_id": "UNKNOWN",
    "sessions_count": 2,
    "page_views": 0
  }
]`;
    // does not exceed, thus added separately
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    // exceeds, thus added as unknown
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    // still exceeds, but updates the value for existing property
    fsmd.addMetric("domain1.com", PAGE_VIEWS, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("works as expect with multiple domains and metrics in most common scenario", function() {
    const domains = [
      "domain1.com",
      "domain2.com",
      "domain3.com",
      "domain4.com",
      "domain5.com"
    ];
    const metrics = [
      SESSIONS_COUNT,
      PAGE_VIEWS
    ];
    const defaultProductionPayloadLimit = 90 * 1024; // 90 Kb
    const fsmd = new MaxLengthMetricsDict(
      defaultProductionPayloadLimit, metrics, null);
    for (const domain of domains) {
      for (const metric of metrics) {
        fsmd.addMetric(domain, metric, 1);
      }
    }

    const expected = "[" +
      domains
        .map(domain => `{"site_id":"${domain}","sessions_count":1,"page_views":1}`)
        .join(",") +
      "]";
    expect(fsmd.serialize()).toEqual(expected);
  });

  it("throws if no metrics provided", function() {
    expect(() => new MaxLengthMetricsDict(100, []))
      .toThrow("No metrics");
  });

  it("throws if unknown metrics added", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT]);
    expect(() => fsmd.addMetric("domain.com", PAGE_VIEWS, 1))
      .toThrow("Unknown metric");
  });
});
