# Example fragment

The purpose of this fragment is to provide a template on how fragments should be structured and
implemented, but also to be used as a playground for understanding how to test fragments in isolation.

The fragment contains:

- **Content Script**: Counts all `<img>` elements with a `src` attribute and sends the result to the service worker.
- **Service Worker Logic**: Writes into local storage the count for each visited domain and increases  
  the count for subsequent visits

## Directory structure

```plaintext
fragment
├── src
│   ├── background       # Any logic that will be running inside the service worker
│   ├── content          # Content scripts
│   ├── shared           # Shared constants and utility functions
├── tests                # Unit tests for the fragment
```

## Typescript

In order to be able to integrate the service worker logic into the extension, you will need to provide
types for your `start` function. The types are generated automatically at `build` time from
the JsDoc and are located in the `dist` directory.

```javascript
/**
 * @typedef {Object} StartParams
 * @property {any} port A reference to the port object
 * @property {addTrustedMessageTypesFunction} addTrustedMessageTypes Function to add the trusted message types
 */

/**
 * A callback function that modifies the allowlist for a tab.
 *
 * @callback addTrustedMessageTypesFunction
 * @param {string | null} origin - The origin of the message.
 * @param {string[]} types - The message types to be trusted.
 */

/**
 * Initializes the dummy fragment.
 *
 * @param {StartParams} StartParams The start parameters
 */
export function start({ port, addTrustedMessageTypes }) {}
```

## How to integrate

### Add the dependency

Add this line to your dependencies in `package.json`.

```json
"@eyeo-fragments/example": "*"
```

### Integrating the service worker

1. **Locate the entry point files**
   - **AdBlock:** [host/adblock/adblock-betafish/background.js](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/blob/main/host/adblock/adblock-betafish/background.js)
   - **Adblock Plus:** [host/adblockplus/src/bootstrap/background/bootstrap.entry.ts](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/blob/main/host/adblockplus/src/bootstrap/background/bootstrap.entry.ts)
2. **Import the start function from your fragment**  
   Add the import statement
   ```javascript
   import { start as exampleFragment } from "@eyeo-fragments/example";
   ```
3. **Execute the start function**
   ```javascript
   exampleFragment();
   ```

### Integrating the content script

1. **Add the content script in the packaged files**  
   Update the webpack configuration

   - **AdBlock:** [host/adblock/build/config/base.mjs](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/blob/main/host/adblock/build/config/base.mjs)
   - **Adblock Plus:** [host/adblockplus/build/webext/config/base.mjs](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/blob/main/host/adblockplus/build/webext/config/base.mjs)

   add the content script into the bundled files

   ```javascript
   {
       dest: "example.preload.js",
       package: "@eyeo-fragments/example",
       src: ["/content"]
   }
   ```

2. **Add the content script in** `manifest.json`
   ```json
   {
     "all_frames": false,
     "js": ["example.preload.js"],
     "matches": ["https://*/*"],
     "run_at": "document_end"
   }
   ```

## Testing

### Unit tests

Unit tests are contained in files in `tests/unit/`.

```bash
npm test -- --scope @eyeo-fragments/example
```

### Functional tests

Functional tests run in a real browser against the test extension in `fragment/test/`. See [fragment/test/README.md](test/README.md) for full instructions.

```sh
npm run build -- --scope fragments-functional-tests
npm run test:fragments -- -- chromium 3
```
