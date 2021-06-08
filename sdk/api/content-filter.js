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

import browser from "webextension-polyfill";

import {createStyleSheet, elemHide} from "adblockpluscore/lib/elemHide.js";
import {elemHideEmulation} from "adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {snippets, compileScript} from "adblockpluscore/lib/snippets.js";
import snippetsLibrarySource
  from "raw-loader!adblockpluscore/lib/content/snippets.js";

import {getFrameInfo} from "./frame-state.js";
import {logItem, tracingEnabled} from "./diagnostics.js";
import {Prefs} from "./prefs.js";

const DEBUG_CSS_PROPERTIES = [["background", "#e67370"],
                              ["outline", "solid red"]];

const DEBUG_CSS_PROPERTIES_SNIPPETS = [
  ["background", "repeating-linear-gradient(to bottom, " +
                 "#e67370 0, #e67370 9px, white 9px, white 10px)"],
  ["outline", "solid red"]
];

export function applyContentFilters(tabId, frameId)
{
  let frame = getFrameInfo(tabId, frameId);
  let emulatedPatterns = [];
  let tracedSelectors;
  let debug = Prefs.elemhide_debug;

  if (!(frame.allowlisted & contentTypes.DOCUMENT))
  {
    let filters = snippets.getFilters(frame.hostname);

    if (filters.length > 0)
    {
      let scripts = filters.map(({script}) => script);
      let environment = {};
      if (debug)
        environment.debugCSSProperties = DEBUG_CSS_PROPERTIES_SNIPPETS;

      browser.tabs.executeScript(
        tabId,
        {
          frameId,
          code: compileScript(scripts, [snippetsLibrarySource], environment),
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).then(() => filters.forEach(filter => logItem(null, filter)),
             () => {});
    }

    if (!(frame.allowlisted & contentTypes.ELEMHIDE))
    {
      let specificOnly = (frame.allowlisted & contentTypes.GENERICHIDE) != 0;
      let trace = tracingEnabled();
      let styleSheet = elemHide.getStyleSheet(frame.hostname,
                                              specificOnly, trace || debug,
                                              trace);

      if (debug)
      {
        let declarationBlock = "{";
        for (let [property, value] of DEBUG_CSS_PROPERTIES)
          declarationBlock += `${property}: ${value} !important;`;
        declarationBlock += "}";

        styleSheet.code = createStyleSheet(styleSheet.selectors,
                                           declarationBlock);
      }

      injectCSS(tabId, frameId, styleSheet.code);

      for (let {selector, text} of elemHideEmulation.getFilters(frame.hostname))
        emulatedPatterns.push({selector, text});

      if (trace)
      {
        tracedSelectors = [];
        for (let selector of styleSheet.selectors)
          tracedSelectors.push([selector, null]);
        for (let exception of styleSheet.exceptions)
          tracedSelectors.push([exception.selector, exception.text]);
      }
    }
  }

  let cssProperties;
  if (debug)
    cssProperties = DEBUG_CSS_PROPERTIES;
  return {emulatedPatterns, cssProperties, tracedSelectors};
}

export function injectCSS(tabId, frameId, code)
{
  browser.tabs.insertCSS(
    tabId,
    {
      code,
      cssOrigin: "user",
      frameId,
      matchAboutBlank: true,
      runAt: "document_start"
    }
  ).catch(() => {}); // Fails if tab or frame no longer exists
}
