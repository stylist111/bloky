export default {
  ewe_background_test: {
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
    }
  },
  ewe_background_test_alternate: {
    test_event: {
      description: "A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "A logging test event that has no associated data"
    }
  },
  ewe_content_api_test: {
    test_got_experiment_flag: {
      description: "In the content test script, an experiment was loaded",
      data: {
        description: "Information about the loaded experiment",
        type: "object",
        properties: {
          flagName: {
            description: "The flag name that was loaded",
            type: "string"
          },
          flag: {
            description: "The loaded value",
            type: "any"
          }
        }
      }
    }
  },
  ewe_ui_api_test: {
    test_message_received: {
      description:
        "A logger test event indicating the UI page received a request to log",
      data: {
        description: "The data sent to the test listener",
        type: "any"
      }
    }
  }
};
