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

import {Prefs} from "./prefs.js";
import {IO} from "./io.js";

export default {
  /**
   * Causes elements targeted by element hiding, element hiding emulation,
   * or snippets to be highlighted instead of hidden.
   * @param {boolean} enabled Enables or disables debug mode.
   */
  setElementHidingDebugMode(enabled)
  {
    Prefs.elemhide_debug = enabled;
  },

  /*
   * Updates the element hiding debug style.
   * @param {Object} debugCssProperties The css properties for
   *                                    the debug element.
   * @param {Object} debugCssSnippetProperties The css properties for
   *                                           the debug snippet element.
   */
  setElementHidingDebugStyle(debugCssProperties, debugCssSnippetProperties)
  {
    if (debugCssProperties)
      Prefs.debug_css_properties = debugCssProperties;

    if (debugCssSnippetProperties)
      Prefs.debug_css_properties_snippets = debugCssSnippetProperties;
  },

  /**
   * @ignore
   */
  async getFilterStorageSource()
  {
    let contents = [];
    await IO.readFromFile(filterStorage.sourceFile,
                          line => contents.push(line));
    return contents;
  }
};
