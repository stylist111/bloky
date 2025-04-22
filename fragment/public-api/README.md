# Public API fragment

## API Reference

`sendExtCommand({ method, targetExt, params, timeoutMs = 3000 })`

### Parameters

| Parameter   |  Type  | Required | Description                                                                                                  |
| :---------- | :----: | :------: | ------------------------------------------------------------------------------------------------------------ |
| `method`    | string |   Yes    | The method to call on the extension (e.g., `'getStatus'`).                                                   |
| `targetExt` | string |    No    | The extension to target (`'adblock'` or `'adblockplus'`). If omitted, all supported extensions are targeted. |
| `params`    | object |    No    | The parameters to pass to the method.                                                                        |
| `timeoutMs` | number |    No    | The timeout in milliseconds. Default: 3000 ms.                                                               |

### Description

The function `sendExtCommand` enables communication with extensions via a central iframe. It is exposed globally on the `window` object and requires:

- An iframe with source `https://ext-bridge.eyeo.com`.
- A running eyeo extension (e.g., AdBlock or Adblock Plus).

Requests can target one or multiple extensions. The response is always an array containing the results or errors from each extension.

---

## Methods

### `getStatus`

Retrieves the current status of one or more extensions.

#### Example

```js
await sendExtCommand({ method: "getStatus" });
```

#### Response Structure

The response is an array of objects. Each object represents the result from a specific extension.

```typescript
type StatusResponse = Array<{
  /**
   * The ID of the extension (e.g., 'adblock' or 'adblockplus').
   */
  name: string;

  /**
   * The manifest version of the extension (e.g., '1.2.3').
   */
  version: string;

  /**
   * The request ID. Generated automaticly and will be the same for each response
   * in this array of responses.
   */
  requestId: string;

  /**
   * The status details of the extension.
   * If an error occurs, this is undefined, and the `error` key will be populated.
   */
  result?: {
    /**
     * License information for the extension.
     * - `null`: No active license.
     * - `string`: Active license key.
     */
    license: string | null;

    /**
     * True if Acceptable Ads (AA) is enabled, false otherwise.
     */
    aa: boolean;

    /**
     * Allowlist object.
     */
    allowlist: {
      /**
       * The allowlist status.
       * - `true`: The current page is allowlisted
       * - `false`: The current page is NOT allowlisted.
       */
      status: boolean;

      /**
       * The allowlist origin.
       * - `undefined`: The allowlist origin is not set.
       * - `string`: The allowlist origin. e.g. 'web'
       */
      origin?: string;

      /**
       * The allowlist expiration time.
       * - `undefined`: The allowlist does not expire.
       * - `number`: The expiration time in milliseconds.
       */
      expiresAt?: number;
    };
  };

  /**
   * A description of the error if the extension fails to respond.
   */
  error?: string;
}>;
```

---

### `allowlistWebsite`

> **Note:** This method is no longer exposed in the public API and cannot be accessed.

#### Example

```javascript
const extResponses = await sendExtCommand({
  method: "allowlistWebsite",
  params: {
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    partialDomain: "example.com",
  },
});

// !IMPORTANT: Check if the website was successfully allowlisted.
if (extResponses.some((resp) => resp?.result?.status === true)) {
  // TODO: refresh the page or update the UI.
}
```

#### Parameters

| Key             |  Type  | Required | Description                                                                                                                                                                                                                                                                                                                                               |
| :-------------- | :----: | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expiresAt`     | number |    No    | The expiration timestamp in milliseconds. Must be between 1 and 365 days from now.                                                                                                                                                                                                                                                                        |
| `partialDomain` | string |    No    | A partial domain to be allowlisted <br/> To be used for allowlisting any TLD+X of the current hostname <br/> Must be a valid domain and a substring of the current's website domain <br/> Examples: <br/> 1. `example.com` is a valid `partialDomain` for `my.site.example.com` <br/> 2. `world.net` is NOT a valid `partialDomain` for `hello.world.com` |

#### Response Structure

The response is an array of objects. Each object represents the result from a specific extension.

```typescript
type AllowlistResponse = Array<{
  /**
   * The ID of the extension (e.g., 'adblock' or 'adblockplus').
   */
  name: string;

  /**
   * The manifest version of the extension (e.g., '1.2.3').
   */
  version: string;

  /**
   * The request ID. Generated automaticly and will be the same for each response
   * in this array of responses.
   */
  requestId: string;

  /**
   * The status details of the extension.
   * If an error occurs, this is undefined, and the `error` key will be populated.
   */
  result?: {
    /**
     * The allowlist status.
     * - `true`: The current page is allowlisted
     * - `false`: The current page is NOT allowlisted.
     */
    status: boolean;

    /**
     * The timestamp when the allowlist was created.
     */
    created: number;

    /**
     * The allowlist origin 'web'
     */
    origin: string;

    /**
     * The allowlist expiration time passed as parameter.
     * - `undefined`: The allowlist does not expire.
     * - `number`: The expiration time in milliseconds.
     */
    expiresAt?: number;
  };

  /**
   * A description of the error if the extension fails to respond.
   */
  error?: string;
}>;
```

---

## Notes

- When targeting multiple extensions, each extension processes the request independently.
- If an extension cannot process the request, the `error` key will provide details.
- Always validate the `params` object to ensure compatibility with the targeted method.

## Testing

### Unit testing

The `./test/unit` folder contains various unit tests files
For `.ts` files we have unit tests that can be run via
`npm run ...`.

### End-to-end testing

TBD
