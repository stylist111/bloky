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
import {MaxLengthMetricsDict} from "../../../src/background/cdp/domains-trimming.js";

const SESSIONS_COUNT = "s";
const PAGE_VIEWS = "p";

const DEFAULT_PAYLOAD_LIMIT = 90 * 1024; // 90 Kb

// https://gitlab.com/eyeo/data/engineering/data-infrastructure/-/blob/main/projects/eyeo-data-eyeometry/metadata/stage/schema/cdp_activeping_noipc/3-encrypted_data.json.md
const DOMAIN_STATS_ONLY_SCHEMA =
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

const SCHEMA =
`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemaregistry.data.eyeo.it/topic/cdp_encrypted_aggregate_noipc/encrypted_data-2",
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
    },
    "es": {
      "type": "object",
      "additionalProperties": {
        "type": "integer"
      }
    }
  },
   "required": [
     "ds", "es"
    ]
 }
`;

describe("Domains trimming", function() {
  it("serializes empty dictionary", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT], false);
    const expected = "{\n  \"ds\": []\n}";
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("serializes empty dictionary with single spacing", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT], false, 1);
    const expected = "{\n \"ds\": []\n}";
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("serializes empty dictionary with event stats", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT], true);
    const expected = `{
  "ds": [],
  "es": {}
}`;
    expect(fsmd.serialize()).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("formats according to passed 'space' argument", function() {
    function assertFormatted(space, expected) {
      const fsmd = new MaxLengthMetricsDict(
        1000, [SESSIONS_COUNT], false, space
      );
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

  it("adds an event", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], true);
    const expected =
`{
  "ds": [],
  "es": {
    "test-event": 5
  }
}`;
    fsmd.addEvent("test-event", 5);

    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("adds multiple events", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], true);
    const expected =
`{
  "ds": [],
  "es": {
    "test-event-1": 5,
    "test-event-2": 102
  }
}`;
    fsmd.addEvent("test-event-1", 5);
    fsmd.addEvent("test-event-2", 102);

    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("adding the same event twice adds the results", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], true);
    const expected =
`{
  "ds": [],
  "es": {
    "test-event": 123
  }
}`;

    fsmd.addEvent("test-event", 3);
    fsmd.addEvent("test-event", 120);

    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("adds a domain separately if does not exceed the limit", function() {
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], false);
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
    const fsmd = new MaxLengthMetricsDict(
      1000, [SESSIONS_COUNT, PAGE_VIEWS], false
    );
    const expected =
`{
  "ds": [
    {
      "i": "domain.com",
      "s": 10,
      "p": 0
    }
  ]
}`;
    fsmd.addMetric("domain.com", SESSIONS_COUNT, 10);
    const actual = fsmd.serialize();
    expect(actual).toEqual(expected);
    expect(fsmd.getLength()).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit", function() {
    const fsmd = new MaxLengthMetricsDict(40, [SESSIONS_COUNT], false);
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
    const fsmd = new MaxLengthMetricsDict(1000, [SESSIONS_COUNT], false);
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
    const fsmd = new MaxLengthMetricsDict(40, [SESSIONS_COUNT], false);
    const expected =
`{
  "ds": [
    {
      "i": "UNKNOWN",
      "s": 21
    }
  ]
}`;
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 20);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("trims a domain if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(80, [SESSIONS_COUNT], false);
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

  it("trims a domain if exceeds the limit including event stats", function() {
    // At a max length of 140, both domains would fit if we weren't setting the
    // event stats first.
    const fsmd = new MaxLengthMetricsDict(140, [SESSIONS_COUNT], true);
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
  ],
  "es": {
    "test-event": 5
  }
}`;

    fsmd.addEvent("test-event", 5);
    // does not exceed, thus added separately
    fsmd.addMetric("domain1.com", SESSIONS_COUNT, 1);
    // exceeds, thus added as unknown
    fsmd.addMetric("domain2.com", SESSIONS_COUNT, 2);
    expect(fsmd.serialize()).toEqual(expected);
    let calculatedSize = fsmd.getLength();
    expect(calculatedSize).toEqual(expected.length);
  });

  it("does not trim for existing only metrics even if exceeds the limit at some point", function() {
    const fsmd = new MaxLengthMetricsDict(80, [SESSIONS_COUNT], false);
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
    const fsmd = new MaxLengthMetricsDict(
      100, [SESSIONS_COUNT, PAGE_VIEWS], false
    );
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
    const fsmd = new MaxLengthMetricsDict(
      DEFAULT_PAYLOAD_LIMIT, metrics, false, null);
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
    expect(() => new MaxLengthMetricsDict(100, [], false))
      .toThrow("No metrics");
  });

  it("ignores if unknown metrics added", function() {
    const fsmd = new MaxLengthMetricsDict(100, [SESSIONS_COUNT], false, null);
    expect(() => fsmd.addMetric("domain.com", PAGE_VIEWS, 1));
    const expected = "{\"ds\":[]}";
    expect(fsmd.serialize()).toEqual(expected);
  });

  for (let testCase of [{
    name: "domain stats only",
    supportEventStats: false,
    schema: DOMAIN_STATS_ONLY_SCHEMA
  }, {
    name: "with event stats",
    supportEventStats: true,
    schema: SCHEMA
  }]) {
    it(`generates a valid JSON - ${testCase.name}`, function() {
      const domains = [
        "domain1.com",
        "domain2.com",
        "domain3.com",
        "domain4.com",
        "domain5.com"
      ];
      const events = [
        "event1",
        "event2",
        "event3"
      ];
      const metrics = [
        SESSIONS_COUNT,
        PAGE_VIEWS
      ];

      const fsmd = new MaxLengthMetricsDict(
        DEFAULT_PAYLOAD_LIMIT, metrics, testCase.supportEventStats, null);

      for (const event of events) {
        fsmd.addEvent(event, 1);
      }

      for (const domain of domains) {
        for (const metric of metrics) {
          fsmd.addMetric(domain, metric, 1);
        }
      }

      const json = fsmd.serialize();

      const schemaObject = JSON.parse(testCase.schema);
      const validator = new Validator();
      validator.addSchema(testCase.schema, schemaObject["$id"]);
      const jsonObject = JSON.parse(json);
      const result = validator.validate(jsonObject, schemaObject);
      expect(result.valid).toEqual(true);
    });
  }
});
