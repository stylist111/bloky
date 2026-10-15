# Source Sans Pro

`src/source-sans-pro-{300,400,700}.woff2` are unmodified copies of Adobe's
Source Sans Pro font, kept as a vendored dependency rather than replaced
with an npm package.

The `@fontsource/source-sans-pro` npm package doesn't ship a single
combined file per weight the way these files are - it only offers
per-script subsets (latin, latin-ext, cyrillic, cyrillic-ext, greek,
greek-ext, vietnamese), because that's how Google Fonts serves this
family. These files cover Latin, Cyrillic and Greek in one file each, so
matching that coverage via the npm package would mean splitting each
weight into 7 separate files (21 files total) with duplicated
`unicode-range` data between `font.css` and the on-page dialog's
`FontFace` registrations - a lot of added complexity for an asset that,
unlike a JS/CSS library, never needs a security or bugfix update.
