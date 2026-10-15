# jsbn

This is a fork of [jsbn][jsbn], a big-number/RSA library by Tom Wu, kept as a
vendored dependency because it carries an eyeo-specific modification not
present in the upstream project or its npm package.

The following modification was made:

- Added support for radix 256 (byte-array/binary-string) encoding and
  decoding to `BigInteger.prototype.fromString` and
  `BigInteger.prototype.toString`, so a `BigInteger` can be constructed
  directly from - and serialized back to - the binary strings produced by
  `atob()`. This is required by `core/sdk/adblockpluscore`'s RSA signature
  verification (`lib/rsa.js`), which is the only consumer of this package.

Changes are marked with `/** MODIFIED **/` comments in the source.

This lives inside `adblockpluscore/` (rather than the monorepo-root
`vendor/`) as a plain file, not its own npm-aliased package, because
`core/sdk`'s `package.json` publishes `adblockpluscore/lib` - and now
`adblockpluscore/vendor` - as raw, unbundled source as part of the
`@eyeo/webext-ad-filtering-solution` npm package. A separate,
never-published `@eyeo/jsbn` workspace package resolved only within this
monorepo would break `require("jsbn")` for anyone installing the SDK from
the npm registry (e.g. the iOS app team, the filterlist delivery system).
Keeping it as a plain file inside `adblockpluscore/` that ships with the
package avoids that.

[jsbn]: https://github.com/andyperlitch/jsbn
