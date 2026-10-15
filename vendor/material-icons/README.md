# Material Icons

`src/MaterialIcons-Regular.woff2` is a hand-subsetted copy of Google's
[Material Icons][material-icons] font, kept as a vendored dependency rather
than replaced with the `material-icons` npm package.

The npm package ships the full, un-subsetted icon font (128KB). This file
is subset down to only the 28 ligature names this codebase actually uses
(44KB) — matching the npm package's full font caused the AdBlock Options
page to load measurably slower, enough to make several Firefox e2e tests
around the Premium flow miss their timeouts. Since this is a static icon
set rather than code, it never needs a security or bugfix update, so
vendoring the existing subset avoided reintroducing that regression.

[material-icons]: https://github.com/google/material-design-icons
