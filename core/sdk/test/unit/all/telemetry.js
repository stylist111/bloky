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

import sinon from "sinon/pkg/sinon.js";
import expect from "expect";
import {AbstractLogger, logLevelNamesToNumbers} from "../../../src/all/telemetry.js";
import {default as events} from "../../../events.js";

const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

const mockEvents = {
  test_ewe_background: {
    test_event: {
      description: "A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "A logging test event that has no associated data"
    },
    test_event_string_data: {
      description: "A logging test event for logging strings",
      data: {
        description: "Test data that must be a string",
        type: "string"
      }
    },
    test_event_numeric_data: {
      description: "A logging test event for logging numbers",
      data: {
        description: "Test data that must be a number",
        type: "number"
      }
    },
    test_event_integer_data: {
      description: "A logging test event for logging integers",
      data: {
        description: "Test data that must be an integer",
        type: "integer"
      }
    },
    test_event_null_data: {
      description: "A logging test event for logging nulls",
      data: {
        description: "Test data that must be a null",
        type: "null"
      }
    },
    test_event_optional_string_data: {
      description: "A logging test event for logging nulls",
      data: {
        description: "Test data that must be a null",
        type: ["string", "null"]
      }
    },
    test_event_object_data: {
      description: "A logging test event for logging objects",
      data: {
        description: "Test data that must be an object with a set structure",
        type: "object",
        properties: {
          name: {
            description: "A person's name",
            type: "string"
          },
          age: {
            description: "A person's age",
            type: "integer"
          }
        }
      }
    },
    test_event_array_data: {
      description: "A logging test event for logging arrays",
      data: {
        description: "Test data that must be an array of strings",
        type: "array",
        items: {
          type: "string"
        }
      }
    },
    test_event_complex_data: {
      description: "A logging test event for complex nested data",
      data: {
        description: "Complex nested data",
        type: ["string", "object", "array"],
        properties: {
          nullable: {
            description: "A nullable string",
            type: ["string", "null"]
          },
          arrayInObject: {
            description: "This is an array mixed strings, numbers and more objects",
            type: "array",
            items: {
              type: ["string", "number", "object"],
              properties: {
                good: {
                  description: "How good this nesting is",
                  type: "boolean"
                }
              }
            }
          }
        },
        items: {
          type: "object",
          properties: {
            favoriteNumber: {
              description: "The best number",
              type: "integer"
            }
          }
        }
      }
    },
    test_event_string_enum: {
      description: "A logging test event for string enums",
      data: {
        description: "Test data that must be one of the allowed string values",
        type: "string",
        enum: ["active", "paused", "stopped"]
      }
    },
    test_event_number_enum: {
      description: "A logging test event for number enums",
      data: {
        description: "Test data that must be one of the allowed number values",
        type: "number",
        enum: [0, 1, 2, 3]
      }
    },
    test_event_integer_enum: {
      description: "A logging test event for integer enums",
      data: {
        description: "Test data that must be one of the allowed integer values",
        type: "integer",
        enum: [100, 200, 300]
      }
    },
    test_event_object_with_enum: {
      description: "A logging test event for objects with enum properties",
      data: {
        description: "Test data that is an object with an enum property",
        type: "object",
        properties: {
          status: {
            description: "The status value",
            type: "string",
            enum: ["pending", "approved", "rejected"]
          },
          count: {
            description: "A count value",
            type: "integer"
          }
        }
      }
    }
  }
};

describe("Debug Telemetry", function() {
  let logger;
  let spy;

  function getValidatedLogCalls() {
    return spy.getCalls().map(x => x.args);
  }

  beforeEach(function() {
    logger = new AbstractLogger("test_ewe_background", mockEvents);
    spy = sinon.spy(logger, "_validatedLog");

    // The invalid events, of which there are many here, log errors to the
    // console when they are called. It makes the test noisy, so this is to
    // suppress them.
    sinon.stub(console, "error");
  });

  afterEach(function() {
    sinon.restore();
  });

  it("core/sdk/events.js has the right format", async function() {
    expect(events).toBeInstanceOf(Object);

    function checkData(validationErrors, context, data,
                       requireDescription = true) {
      if (typeof data != "object") {
        validationErrors.push(`${context} is not an object`);
        return;
      }

      if (requireDescription && typeof data.description != "string") {
        validationErrors.push(`${context}.description is not a string`);
      }

      // Type is either a string or an array of strings. If it's a string, it
      // should be treated as a single element array.
      let types = data.type;
      if (typeof types === "string") {
        types = [types];
      }

      const validTypes = ["array", "boolean", "null", "integer", "number", "object", "string", "any"];
      if (!types.every(type => validTypes.includes(type))) {
        validationErrors.push(`${context}.type is not valid. Expected an array containing a subset of ${validTypes}, or a single string that is one of the above.`);
      }

      if (types.includes("object")) {
        if (typeof data.properties != "object") {
          validationErrors.push(`${context}.properties is not an object. It is required for objects.`);
        }

        let propertyIds = Object.keys(data.properties);
        if (propertyIds.length == 0) {
          validationErrors.push("${context}.properties specifies no properties");
        }

        for (let propertyId of propertyIds) {
          checkData(validationErrors, `${context}.properties.${propertyId}`, data.properties[propertyId]);
        }
      }

      if (types.includes("array")) {
        if (typeof data.items != "object") {
          validationErrors.push(`${context}.items is not an object. It is required for arrays.`);
        }
        checkData(validationErrors, `${context}.items`, data.items, false);
      }

      // Validate enum property if present
      if (typeof data.enum !== "undefined") {
        if (!Array.isArray(data.enum)) {
          validationErrors.push(`${context}.enum must be an array of allowed values.`);
        }
        else if (data.enum.length === 0) {
          validationErrors.push(`${context}.enum must not be empty.`);
        }
      }
    }

    let validationErrors = [];

    const moduleIds = Object.keys(events);
    if (moduleIds.length == 0) {
      validationErrors.push("No modules found");
    }

    for (let moduleId of moduleIds) {
      const module = events[moduleId];
      if (typeof module != "object") {
        validationErrors.push(`${moduleId} is not an object`);
        continue;
      }

      const eventIds = Object.keys(events[moduleId]);
      if (eventIds.length == 0) {
        validationErrors.push(`${moduleId} had no events`);
      }

      for (let eventId of eventIds) {
        const event = events[moduleId][eventId];
        if (typeof event != "object") {
          validationErrors.push(`${moduleId}.${eventId} is not an object`);
          continue;
        }

        if (typeof event.description != "string") {
          validationErrors.push(`${moduleId}.${eventId}.description is not a string`);
        }

        if (typeof event.data !== "undefined") {
          const data = event.data;
          checkData(validationErrors, `${moduleId}.${eventId}.data`, data);
        }
      }
    }

    expect(validationErrors).toEqual([]);
  });

  it("logs some data", function() {
    logger.debug("test_event", {potato: true});
    expect(getValidatedLogCalls()).toEqual([
      [
        expect.stringMatching(ISO_DATE_REGEX),
        logLevelNamesToNumbers.debug,
        "test_event",
        {potato: true},
        void 0
      ]
    ]);
  });

  it("IPM ID can be logged for behavior logs", function() {
    let ipmId = "someIpmId";

    logger.debug("test_event", {}, ipmId);
    logger.behavior("test_event", {}, ipmId);

    expect(getValidatedLogCalls()).toEqual([
      [
        expect.stringMatching(ISO_DATE_REGEX),
        logLevelNamesToNumbers.debug,
        "test_event",
        {},
        void 0
      ],
      [
        expect.stringMatching(ISO_DATE_REGEX),
        logLevelNamesToNumbers.behavior,
        "test_event",
        {},
        ipmId
      ]
    ]);
  });

  it("rejects nonserializable data", function() {
    let cyclicData = {};
    cyclicData.self = cyclicData;

    logger.debug("test_event", cyclicData);
    logger.debug("test_event", new Error("some message"));
    logger.debug("test_event", () => {});
    logger.debug("test_event", {innerArray: [1, () => {}]});
    logger.debug("test_event", {toJSON() {}});
    logger.debug("test_event", NaN);
    logger.debug("test_event", Infinity);
    logger.debug("test_event", /./);
    logger.debug("test_event", Symbol("test"));
    logger.debug("test_event", 9007199254740991n);
    logger.debug("test_event", new Uint8Array(10).buffer);
    logger.debug("test_event", Object.create({}, {hidden: {value: "secret", enumerable: false}}));

    expect(getValidatedLogCalls()).toHaveLength(0);
  });

  const dataTestCases = [{
    eventId: "test_event",
    validData: ["good", 5, null, {}],
    invalidData: [void 0]
  }, {
    eventId: "test_event_no_data",
    validData: [void 0],
    invalidData: ["bad", {}]
  }, {
    eventId: "test_event_string_data",
    validData: ["good"],
    invalidData: [null, 0.5, 1]
  }, {
    eventId: "test_event_numeric_data",
    validData: [0.5, 1],
    invalidData: [null, "bad", {a: 1}]
  }, {
    eventId: "test_event_integer_data",
    validData: [1],
    invalidData: [0.5, null, "bad", {a: 1}]
  }, {
    eventId: "test_event_null_data",
    validData: [null],
    invalidData: [0.5, "bad", [null]]
  }, {
    eventId: "test_event_optional_string_data",
    validData: ["good", null],
    invalidData: [1, [null], {}]
  }, {
    eventId: "test_event_object_data",
    validData: [
      {name: "Bingo", age: 3},
      {name: "Bandit", age: 30, unknown: void 0},
      {name: "Bluey", age: 7, additional: 35}
    ],
    invalidData: [
      1,
      [null],
      {},
      {name: 1, age: 3},
      {name: "Bingo"},
      {name: void 0, age: 5}
    ]
  }, {
    eventId: "test_event_array_data",
    validData: [["a", "b", "c"]],
    invalidData: [1, [null], {}, ["a", "b", 3]]
  }, {
    eventId: "test_event_complex_data",
    validData: [
      "data",
      {
        nullable: null,
        arrayInObject: ["yes", 1.5]
      },
      {
        nullable: "a value",
        arrayInObject: [{
          good: true
        }]
      },
      [{
        favoriteNumber: 4
      }, {
        favoriteNumber: 5
      }]
    ],

    invalidData: [
      1,
      {
        nullable: 1,
        arrayInObject: ["yes", 1.5]
      },
      {
        nullable: null,
        arrayInObject: [null]
      },
      {
        nullable: null,
        arrayInObject: [{
          good: "potato"
        }]
      },
      [{
        favoriteNumber: null
      }],
      [{}]
    ]
  }, {
    eventId: "test_event_string_enum",
    validData: ["active", "paused", "stopped"],
    invalidData: ["invalid", "ACTIVE", "Active", "", null, 1, {}]
  }, {
    eventId: "test_event_number_enum",
    validData: [0, 1, 2, 3],
    invalidData: [4, -1, 0.5, 1.5, "1", null, {}]
  }, {
    eventId: "test_event_integer_enum",
    validData: [100, 200, 300],
    invalidData: [0, 150, 100.5, "100", null, {}]
  }, {
    eventId: "test_event_object_with_enum",
    validData: [
      {status: "pending", count: 5},
      {status: "approved", count: 0},
      {status: "rejected", count: 10}
    ],
    invalidData: [
      {status: "invalid", count: 5},
      {status: "PENDING", count: 5},
      {status: 1, count: 5},
      {status: "pending"},
      {count: 5}
    ]
  }];

  for (let testCase of dataTestCases) {
    it(`logs only the expected data for the ${testCase.eventId} event`, function() {
      for (let data of testCase.validData) {
        logger.debug(testCase.eventId, data);
      }
      for (let data of testCase.invalidData) {
        logger.debug(testCase.eventId, data);
      }

      let expectedCalls = testCase.validData.map(data => [
        expect.stringMatching(ISO_DATE_REGEX),
        logLevelNamesToNumbers.debug,
        testCase.eventId,
        data,
        void 0
      ]);

      expect(getValidatedLogCalls()).toEqual(expectedCalls);
    });
  }
});
