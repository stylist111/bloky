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
import {Validator} from "jsonschema";
import {MaxLengthMetricsDict} from "../../../sdk/background/domains-trimming.js";

const SESSIONS_COUNT = "s";
const PAGE_VIEWS = "p";

describe("Domains trimming", function() {
  it("serializes empty dictionary", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT]);
    const expected = "{\n  \"ds\": []\n}";
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

    const noIndentationString = "{\"ds\":[{\"i\":\"domain1.com\",\"s\":0}]}";
    assertFormatted(null, noIndentationString);
    assertFormatted(0, noIndentationString);
    assertFormatted("", noIndentationString);

    const singleSpaceIndentationString =
`{
 "ds": [
  {
   "i": "domain1.com",
   "s": 0
  }
 ]
}`;
    assertFormatted(1, singleSpaceIndentationString);
    assertFormatted(" ", singleSpaceIndentationString);
    assertFormatted("\t",
`{
\t"ds": [
\t\t{
\t\t\t"i": "domain1.com",
\t\t\t"s": 0
\t\t}
\t]
}`);
    const doubleSpaceIndentationString =
`{
  "ds": [
    {
      "i": "domain1.com",
      "s": 0
    }
  ]
}`;
    assertFormatted(2, doubleSpaceIndentationString);
    assertFormatted("  ", doubleSpaceIndentationString);

    const fourSpacesIndentationString =
`{
    "ds": [
        {
            "i": "domain1.com",
            "s": 0
        }
    ]
}`;
    assertFormatted(4, fourSpacesIndentationString);
    assertFormatted("    ", fourSpacesIndentationString);
  });

  it("adds a domain separately if does not exceed the limit", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "domain.com",
      "s": 1
    }
  ]
}`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("adds a domain separately if does not exceed the limit with multiple metrics", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT, PAGE_VIEWS]);
    const expected =
`{
  "ds": [
    {
      "i": "domain.com",
      "s": 1,
      "p": 0
    }
  ]
}`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit", function() {
    const fsmd = new MaxLengthMetricsDict(40, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "UNKNOWN",
      "s": 1
    }
  ]
}`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 1);
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("always trims long domains", function() {
    // trims all the domains longer than 25 characters,
    // even if it fits into the payload limit
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "UNKNOWN",
      "s": 1
    }
  ]
}`;
    fsmd.addMetric("alongdomainthatexceedsthe25charslimit.com", SESSIONS_COUNT, 1);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);

    fsmd.addMetric("someotherlongdomainthatexceedsthe25charslimit.com", SESSIONS_COUNT, 2);
    const expected2 =
`{
  "ds": [
    {
      "i": "UNKNOWN",
      "s": 3
    }
  ]
}`;
    expect(fsmd.serialize()).toEqual(expected2);
    expect(fsmd.getLength()).toEqual(expected2.length);
  });

  it("trims all the domains if exceeds the limit", function() {
    const fsmd = new MaxLengthMetricsDict(40, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "UNKNOWN",
      "s": 3
    }
  ]
}`;
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(80, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "domain1.com",
      "s": 1
    },
    {
      "i": "UNKNOWN",
      "s": 2
    }
  ]
}`;
    // does not exceed, thus added separately
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    // exceeds, thus added as unknown
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("does not trim for existing only metrics even if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(80, [SESSIONS_COUNT]);
    const expected =
`{
  "ds": [
    {
      "i": "domain1.com",
      "s": 4
    },
    {
      "i": "UNKNOWN",
      "s": 2
    }
  ]
}`;
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
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT, PAGE_VIEWS]);
    const expected =
`{
  "ds": [
    {
      "i": "domain1.com",
      "s": 1,
      "p": 2
    },
    {
      "i": "UNKNOWN",
      "s": 2,
      "p": 0
    }
  ]
}`;
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

    const expected = "{\"ds\":[" +
      domains
        .map(domain => `{"i":"${domain}","s":1,"p":1}`)
        .join(",") +
      "]}";
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

  it("generates a valid JSON", function() {
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

    // https://gitlab.com/eyeo/data/engineering/data-infrastructure/-/blob/main/projects/eyeo-data-eyeometry/metadata/stage/schema/cdp_activeping_noipc/3-encrypted_data.json.md
    const schema =
`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemaregistry.data.eyeo.it/topic/cdp_encrypted_aggregate_noipc/encrypted_data-1",
  "title": "CDP encrypted aggregate ping protocol",
  "type": "object",
  "additionalProperties": false,
   "properties": {
    "ds": {
      "description": "Aggregate statistics for accessing domains.",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "i": {
            "description": "Identifier for the site. Example: 'yahoo.com'",
            "type": "string"
          },
          "s": {
            "description": "Count of session for client Y on domain X. Example: '3'",
            "type": "integer"
          },
          "p": {
            "description": "Count of page views for client Y on domain X. Example: '7'",
            "type": "integer"
          }
        },
        "required": ["i", "s"]
      }
    }
  },
   "required": [
     "ds"
    ]
 }
`;

    const json = fsmd.serialize();
    const validator = new Validator();
    validator.addSchema(schema, "https://schemaregistry.data.eyeo.it/topic/cdp_encrypted_aggregate_noipc/encrypted_data-1");
    const jsonObject = JSON.parse(json);
    const schemaObject = JSON.parse(schema);
    const result = validator.validate(jsonObject, schemaObject);
    expect(result.valid).toEqual(true);
  });
});
