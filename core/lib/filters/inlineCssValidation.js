/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/** @module */

/**
 * Validates the CSS properties based on the rules in
 * https://gitlab.com/eyeo/adblockplus/ad-filtering-working-group/-/blob/main/filter-syntax.md#valid-css-property-names-and-values
 *
 * @param {Object} css The parsed properties to validate. Each property on the
 *   object should be a valid CSS property.
 * @returns {boolean} True if the CSS properties are all valid.x
 */
exports.verifyCSSProperties = function verifyCSSProperties(css) {
  if (Object.keys(css).length == 0) {
    return false;
  }

  for (let name in css) {
    if (!verifyCSSPropertyName(name) || !verifyCSSPropertyValue(css[name])) {
      return false;
    }
  }

  return true;
};

function verifyCSSPropertyName(name) {
  return /^(-?[a-z]+)+$/.test(name);
}

function verifyCSSPropertyValue(value) {
  // splitting is to allow lists of valid values, for example in shorthand
  // properties like `margin` or `border`.
  let subvalues = value.split(" ").filter(subvalue => subvalue.length > 0);
  if (subvalues.length == 0) {
    return false;
  }

  return subvalues.every(subvalue => {
    return CSS_VALIDATION_WHITELIST.some(validValue => {
      if (validValue instanceof RegExp) {
        return validValue.test(subvalue);
      }

      return validValue == subvalue;
    });
  });
}

// This should be kept in sync with https://gitlab.com/eyeo/adblockplus/ad-filtering-working-group/-/blob/main/filter-syntax.md#property-values
const CSS_VALIDATION_WHITELIST = [
  "inherit",
  "initial",
  "none",
  "revert",
  "revert-layer",
  "unset",
  /^#[0-9a-f]{3,8}$/,
  "currentcolor",
  /^[+-]?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?(cm|mm|q|in|pc|pt|px|em|ex|ch|rem|lh|rlh|vw|vh|vmin|vmax|vb|vi|svw|svh|lvw|lvh|dvw|dvh|%|fr)?$/,
  "absolute",
  "all",
  "auto",
  "block",
  "both",
  "clip",
  "collapse",
  "contain",
  "dashed",
  "default",
  "dotted",
  "double",
  "element",
  "fit-content",
  "fixed",
  "flex",
  "flow-root",
  "flow",
  "grid",
  "groove",
  "hidden",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "inline",
  "inset",
  "left",
  "list-item",
  "max-content",
  "min-content",
  "outset",
  "pointer",
  "relative",
  "ridge",
  "right",
  "ruby",
  "scroll",
  "solid",
  "static",
  "sticky",
  "table-row",
  "table",
  "text",
  "thin",
  "transparent",
  "true",
  "visible"
];
