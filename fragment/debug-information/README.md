# debug-information fragment

## Intro

This fragment gathers and returns common debug information about the host extension, including device, extension, and platform details, as well as error and migration information.

**Key Functionality:**

Returns the following information in human readable JSON object that can be 'stringified':
- User agent and platform info (browser, OS, versions)
- Extension info (version, ID, manifest version)
- Device-specific info (premium license information, preferences, settings)
- Subscription Details: Gathers information about filter list subscriptions, including status and download history.
- Custom Filter Metadata: Collects user-defined filter rules and their metadata.
- Remote Configuration Data, including cohort, and other experiment assignments and flags from the extension’s experiment system.
- Host Permissions: Retrieves all permissions granted to the extension.
- JavaScript Errors: Fetches any stored JavaScript errors from local storage.
- Migration Errors: Retrieves errors related to migration of filters and subscriptions, if available.
- Alarm Information: Retrieves all active browser alarms and their scheduled times.

**Usage:**

**`getDebugInformation`**
The single function `getDebugInformation(parameters)` is asynchronous and returns an object containing all the collected debug data, suitable for diagnostics, testing or support purposes.

The `getDebugInformation` parameters will be included in the response object in the `hostSpecificInformation` key.  These parameters should be JSON-serializable objects since they will be passed to other contexts of the host extension via messaging.


### Unit testing

The `./test/unit` folder contains various unit tests files
For `.ts` files we have unit tests that can be run via
`npm run test`.
