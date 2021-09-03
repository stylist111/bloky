/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import {filterStorage} from "adblockpluscore/lib/filterStorage.js";

import {IO} from "./io.js";

export let debugOptions = {
  elemHide: false,
  cssProperties: [["background", "#e67370"], ["outline", "solid red"]],
  snippetsCssProperties: [
    ["background", "repeating-linear-gradient(to bottom, #e67370 0," +
     "#e67370 9px, white 9px, white 10px)"],
    ["outline", "solid red"]]
};

export default {
  /**
   * Causes elements targeted by element hiding, element hiding emulation,
   * or snippets to be highlighted instead of hidden.
   * @param {boolean} enabled Enables or disables debug mode.
   */
  setElementHidingDebugMode(enabled)
  {
    debugOptions.elemHide = enabled;
  },

  /*
   * Updates the element hiding debug style.
   * @param {Object} cssProperties The css properties for
   *                               the debug element.
   * @param {Object} snippetsCssProperties The css properties for
   *                                       the debug snippet element.
   */
  setElementHidingDebugStyle(cssProperties, snippetsCssProperties)
  {
    if (cssProperties)
      debugOptions.cssProperties = cssProperties;

    if (snippetsCssProperties)
      debugOptions.snippetsCssProperties = snippetsCssProperties;
  },

  /**
   * @ignore
   * @param {string} text
   */
  async isInFilterStorage(text)
  {
    let contents = [];
    await IO.readFromFile(filterStorage.sourceFile,
                          line => contents.push(line));
    return contents.some(line => line.includes(text));
  }
};
