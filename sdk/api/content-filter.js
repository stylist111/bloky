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

import browser from "webextension-polyfill";

import {createStyleSheet, elemHide} from "adblockpluscore/lib/elemHide.js";
import {elemHideEmulation} from "adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {snippets, parseScript} from "adblockpluscore/lib/snippets.js";

import {getFrameInfo} from "./frame-state.js";
import {logItem, tracingEnabled} from "./diagnostics.js";
import {debugOptions} from "./debugging.js";

let isolatedLib;
let injectedLib;

export function setSnippetLibrary({isolatedCode, injectedCode}) {
  isolatedLib = isolatedCode;
  injectedLib = injectedCode;
}

export function applyContentFilters(tabId, frameId) {
  let frame = getFrameInfo(tabId, frameId);
  let details = {tabId, frameIds: [frameId]};
  let emulatedPatterns = [];
  let tracedSelectors;

  if (!(frame.allowlisted & contentTypes.DOCUMENT)) {
    let filters = snippets.getFilters(frame.hostname);

    if (filters.length > 0) {
      let scripts = filters.map(({script}) => script);
      let environment = {};
      if (debugOptions.elemHide)
        environment.debugCSSProperties = debugOptions.snippetsCssProperties;

      let isolated = [];
      let main = [];

      for (let script of scripts) {
        for (let [snippet, ...args] of parseScript(script)) {
          if (isolatedLib.has(snippet))
            isolated.push([snippet, ...args]);
          if (injectedLib.has(snippet))
            main.push([snippet, ...args]);
        }
      }

      let execute = [];
      if (browser.scripting && browser.scripting.executeScript) {
        if (isolated.length > 0) {
          execute.push(
            browser.scripting.executeScript({
              target: details,
              world: "ISOLATED",
              func: isolatedLib,
              args: [environment, ...isolated]
            })
          );
        }

        if (main.length > 0) {
          execute.push(
            browser.scripting.executeScript({
              target: details,
              world: "MAIN",
              func: injectedLib,
              args: [environment, ...main]
            })
          );
        }
      }
      else {
        if (isolated.length > 0) {
          const args = JSON.stringify([environment, ...isolated]);
          const code = `(${isolatedLib}).apply(null,${args})`;
          execute.push(
            browser.tabs.executeScript(
              tabId,
              {
                frameId,
                code,
                matchAboutBlank: true,
                runAt: "document_start"
              }));
        }

        if (main.length > 0) {
          const args = JSON.stringify([environment, ...main]);
          const code =
          `function injectSnippetsInMainContext(exec)
          {
            // injecting phases
            let script = document.createElement("script");
            script.type = "application/javascript";
            script.async = false;

            // Firefox 58 only bypasses site CSPs when assigning to 'src',
            // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
            // only bypass site CSPs when using 'textContent'.
            if (typeof netscape != "undefined" && typeof browser != "undefined")
            {
              let url = URL.createObjectURL(new Blob([executable]));
              script.src = url;
              document.documentElement.appendChild(script);
              URL.revokeObjectURL(url);
            }
            else
            {
              script.textContent = executable;
              document.documentElement.appendChild(script);
            }

            document.documentElement.removeChild(script);
          };
          const executable = \`(${injectedLib}).apply(null,${args});\`;
          injectSnippetsInMainContext(executable);`;
          execute.push(
            browser.tabs.executeScript(
              tabId,
              {
                frameId,
                code,
                matchAboutBlank: true,
                runAt: "document_start"
              }));
        }
      }

      Promise.all(execute).then(() => filters.forEach(filter => {
        logItem({tabId, frameId}, filter, {
          docDomain: frame.hostname,
          method: "snippet"
        });
      }), () => {});
    }

    if (!(frame.allowlisted & contentTypes.ELEMHIDE)) {
      let specificOnly = (frame.allowlisted & contentTypes.GENERICHIDE) != 0;
      let trace = tracingEnabled(tabId);
      let styleSheet = elemHide.getStyleSheet(
        frame.hostname,
        specificOnly, trace || debugOptions.elemHide,
        trace
      );

      if (debugOptions.elemHide) {
        let declarationBlock = "{";
        for (let [property, value] of debugOptions.cssProperties)
          declarationBlock += `${property}: ${value} !important;`;
        declarationBlock += "}";

        styleSheet.code = createStyleSheet(styleSheet.selectors,
                                           declarationBlock);
      }

      injectCSS(tabId, frameId, styleSheet.code);

      for (let {selector, text} of elemHideEmulation.getFilters(frame.hostname))
        emulatedPatterns.push({selector, text});

      if (trace) {
        tracedSelectors = [];
        for (let selector of styleSheet.selectors)
          tracedSelectors.push([selector, null]);
        for (let exception of styleSheet.exceptions)
          tracedSelectors.push([exception.selector, exception.text]);
      }
    }
  }

  let cssProperties;
  if (debugOptions.elemHide)
    cssProperties = debugOptions.cssProperties;
  return {emulatedPatterns, cssProperties, tracedSelectors};
}

export function injectCSS(tabId, frameId, code) {
  let result;

  if (browser.scripting && browser.scripting.insertCSS) {
    result = browser.scripting.insertCSS({
      target: {tabId, frameIds: [frameId]},
      css: code,
      origin: "USER"
    });
  }
  else {
    result = browser.tabs.insertCSS(
      tabId,
      {
        code,
        cssOrigin: "user",
        frameId,
        matchAboutBlank: true,
        runAt: "document_start"
      }
    );
  }

  result.catch(() => {}); // Fails if tab or frame no longer exists
}
