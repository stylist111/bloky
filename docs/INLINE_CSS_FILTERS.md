# Inline CSS Filters

Inline CSS filters let filter list authors apply CSS properties directly to
matched DOM elements rather than hiding them. This is used to remove adverts
that can't be removed by simply hiding elements, like backgrounds. It is also
used to clean up artifacts left over after removing ad elements.

This document covers the filter syntax, the parsing pipeline, and the execution
pipeline.

## Filter syntax

```
domain##selector {property: value; property: value}
domain#?#selector {property: value; property: value}
```

The `##` marker designates an element hiding filter. `#?#` means an element
hiding emulation filter. CSS block `{…}` after the selector turns it into an
inline CSS filter.

**Examples**

```
example.com#?#div.ad {display: none}
example.com#?##banner {margin-bottom: 0px; margin-top: 0px}
example.com#?#.overlay {position: static; overflow: visible}
```

See also: [filter syntax spec](https://gitlab.com/eyeo/adblockplus/ad-filtering-working-group/-/blob/main/filter-syntax.md#element-hiding)

## Parsing

- All filter parsing happens in [`core/sdk/adblockpluscore/lib/filterClasses.js`](../core/sdk/adblockpluscore/lib/filterClasses.js).
- Filter texts are normalized by calling `Filter.normalize` from the filter
  engine before any parsing. This means that the parsing doesn't need to take
  into account inconsistent spacing, semicolon use, or the `!important` flag.
- The entry point is `Filter.fromText()`. This will do very high level parsing
  and then delegate to a more specific `fromText` functions for different types
  of filters.
- `ContentFilter.fromText()` identifies inline css filters based on them having
  a CSS body. If that body has the `remove:true` property, then it is a remove
  filter, not an inline CSS filter, regardless of what other CSS properties are
  set.
- The property list is split into property names and values. This allows
  validating names and values separately.
- Validation happens in [`core/sdk/adblockpluscore/lib/filters/inlineCssValidation.js`](../core/sdk/adblockpluscore/lib/filters/inlineCssValidation.js).
- If there are any validation issues, the filter is an `InvalidFilter` and
  doesn't do anything.
- Currently, all inline CSS filters become `ElemHideEmulationFilter`. This is
  only because there is not currently an implementation of inline CSS filters
  using `ElemHideFilter`, but this could be added in the future.

## Execution pipeline

Inline CSS filters are executed as element hiding emulation filters.

- When a page navigation is detected, `applyContentFilters()` in
  [`core/sdk/src/background/content-filter.js`](../core/sdk/src/background/content-filter.js)
  queries the filter engine for any element hiding emulation filters using
  `filterEngine.elemHideEmulation.getFilters(frame.hostname)`
- The resulting filters are sent to the content script via the
  `"ewe:apply-content-features"` message.
- `handleContentFeatures()` in
  [`core/sdk/src/content/isolated/core/element-hiding.js`](../core/sdk/src/content/isolated/core/element-hiding.js)
  receives the message and applies the filters.
- The application of element hiding emulation filters happens by calling
  `ElemHideEmulation.apply()` in
  [`core/sdk/adblockpluscore/lib/content/elemHideEmulation.js`](../core/sdk/adblockpluscore/lib/content/elemHideEmulation.js). This
  core module evaluates the selectors in the filters against the DOM. This
  includes any custom selectors like `-abp-has()`.
- The DOM is also watched for any live changes. Reevaluating filters is rate
  limited to avoid causing pages with many changes to freeze.
- Matched elements are collected and routed a callback in
  [`core/sdk/src/content/isolated/core/element-hiding.js`](../core/sdk/src/content/isolated/core/element-hiding.js). In
  the case of inline CSS filters, the `applyInlineCSS` callback is called for
  matching elements.

### Devtools panel

If filter tracing is enabled, `applyInlineCSS` sends the matched filter texts to
the background via `ElementHidingTracer.log()`, which emits a
`ewe:trace-elem-hide` message. This supports the issue reporter and debugging
tools.
