# Croppie

This is a fork of [Croppie][croppie] v2.6.4, an image-cropping library used by
AdBlock's image-swap options page. It is kept as a vendored dependency
because it carries eyeo-specific modifications not present upstream:

- Removed the bundled Promise polyfill.
- Changed canvas handling to always use an image or canvas element attached
  to the DOM, working around browsers where the `image-orientation` CSS
  property defaults to `from-image`.
- Added `display: flex; flex-direction: row;` to `.croppie-container` in
  `croppie.css`.

Changes are marked with `AdBlock modification` comments in the source.

`src/croppie.js` and `src/croppie.css` are loaded directly as static
assets (via `<script>`/`<link>` tags in
`host/adblock/adblock-betafish/options/index.html`), not bundled through
webpack — see `host/adblock/build/config/base.mjs` for how they're copied
into the build output.

[croppie]: https://github.com/Foliotek/Croppie
