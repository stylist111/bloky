# Debug Telemetry API Documentation

## Overview

This is a structured way of logging data to an endpoint in a privacy aware way.

This API allows consistent logging from:

- Service workers and background scripts
- Content scripts
- UI pages

## Current State

Currently none of the logs will go anywhere, instead they'll be logged to the
console. Sending these to the server is the next phase.

## Log Levels

| Level      | Value | Description                                          |
|------------|-------|------------------------------------------------------|
| `debug`    | 1     | Detailed information for debugging purposes          |
| `info`     | 2     | General information about system operation           |
| `behavior` | 3     | Used for tracking user behavior/interactions         |
| `warn`     | 4     | Warnings and potential issues                        |
| `off`      | 5     | No logging (can be used to disable specific modules) |

## How do I set this up?

### Document your new events

All modules and events must be documented in
[events.js](../core/sdk/events.js). This file will be converted to JSON and
uploaded to our data platform on each release, so that data analysts know which
events are available and what they mean.

```javascript
// events.js is just one big JSON object

export default {
  // The top level property is the module name. This is what you will pass to
  // new ServerLogger(module). As a naming convention, prefer snake_case names
  // for modules.
  "blocking": {
    // Modules contain events. This is what you will pass to
    // serverLogger.debug(event). As a naming convention, prefer snake_case names
    // for events.
    "blocked_something": {
      "description": "Something has been blocked",
      // If an event has associated data, its schema can be documented
      // here. This should follow JSON schema, specifying at least a
      // description, type, properties (for objects) and items (for arrays).
      "data": {
        "description": "Element id of the blocked item",
        "type": "string"
      }
    },

    "allowlisted_something": {
      "description": "Something has been allowlisted"
      // This behavior doesn't have any data, so the `data` property must be
      // omitted.
    },

    "nice_checker_event": {
      "description": "Checks that nice?",
      // This event's data is an object, so the properties on the data are
      // documented.
      "data": {
        "description": "Nice things",
        "type": "object",
        "properties": {
          "name": {
            "description": "A name. Not all nice things have names, so it can also be null",
            // If type is an array, all the given values are valid
            "type": ["string", "null"]
          }, 
          "nice": {
            "description": "Element id of the blocked item",
            "type": "string"
          }, 
          "number": {
            "description": "Element id of the blocked item",
            "type": "number"
          }
        }
      }
    },

    "array_event": {
      description: "Event that",
      data: {
        description: "A sequence of numbers",
        type: "array",
        items: {
          // items doesn't need a description, because the array description
          // should cover it
          type: "number"
        }
      }
    },

    "unstructured_event": {
      description: "Event that has unknown data associated with it",
      data: {
        description: "Interesting data",
        // any allows any value that can be serialized to JSON, including null,
        // but rejects undefined
        type: "any"
      }
    }
  }
};
```

Valid types for data are `any`, `array`, `object`, `boolean`, `null`, `integer`,
`number`, or `string`.

### Call the logger

First you have to import the ewe object. See
[README](../core/sdk/README.md#API). Note that the import differs depending on
if it's a background script, content script, or UI page. The SDK object is
generally called `EWE` in the SDK, and `ewe` everywhere else.

```javascript
// Creating the logger. You have to give it the current module
const serverLogger = new ewe.telemetry.ServerLogger("module_name");

// Log at different levels
serverLogger.debug("initialization_complete", { version: "1.2.3" });
serverLogger.info("feature_enabled", "cool_experiment" );
serverLogger.behavior("button_clicked", { buttonId: "enable_premium",  });
serverLogger.warn("api_call_failed", { endpoint: "/data", status: 404 });
```

### Testing your logs with console output

This system is meant to log to a server. Console output is intended purely as a
debugging tool for engineers.

By default console logging is disabled but you can enable it for your session by
running this in the browser's development tools console:

```javascript
// Set logging level globally
await ewe.telemetry.setConsoleLogLevel("debug");

// Set logging level for a specific module
await ewe.telemetry.setConsoleLogLevel("info", "module_name");

// Disable the console logging
await ewe.telemetry.resetConsoleLogLevel();
```

When logs appear in the console, they follow this format:

```
[timestamp ISO format] [module name] [log level] [event name] [optional data object]
```

Example:
```
2025-05-15T12:34:56.789Z my_module debug initialization_complete {version: "1.2.3"}
```

## Rules for logging

- Never log any personal or sensitive information. Assume that anything passed
  into the logger will be sent to a server.
- Event names have to be unique within a module. Events are not valuable when
  they can happen in multiple places.
- A module is a grouping for the events. It makes sense to line this up with a
  feature. For example: "IPM", "Experiments", "CDP".
- All events must be documented in [core/sdk/events.js](core/sdk/events.js). If
  an event is not listed there, then it will not be logged, and instead an error
  will be printed to the console about the incorrect usage.
- If the event expects data, that data must be documented in
  [core/sdk/events.js](core/sdk/events.js). If the format of data does not match
  the expected schema, then the event will not be logged, and instead an error
  will be printed to the console about the incorrect usage. Only data that can
  be serialized to JSON is supported. For example: strings, plain objects,
  finite numbers, arrays, booleans, and nulls.
