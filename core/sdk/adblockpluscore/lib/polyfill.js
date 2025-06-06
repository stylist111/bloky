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

// Promise.prototype.finally is not supported in Firefox < 58
if (!Promise.prototype.finally) {
  Promise.prototype.finally = function(fn) {
    return this.then(fn, fn);
  };
}

// Object.hasOwn is not supported in Firefox < 92
// Note: Using https://github.com/es-shims/Object.hasOwn/
// will result in checkbuildsize pipeline failure, so for now we're using
// a simple polyfill
if (!Object.hasOwn) {
  Object.hasOwn = function(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

// String.prototype.replaceAll is not supported in Firefox < 77
// Note: Using https://github.com/es-shims/String.prototype.replaceAll/
// will result in checkbuildsize pipeline failure, so for now we're using
// a simple polyfill
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function(search, replacement) {
    if (typeof search === "string") {
      return this.split(search).join(replacement);
    }
    else if (search instanceof RegExp) {
      return this.replace(search, replacement);
    }
    throw new TypeError("Invalid arguments");
  };
}
