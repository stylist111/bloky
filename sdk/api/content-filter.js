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

import {createStyleSheet} from "adblockpluscore/lib/elemHide.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {parseScript} from "adblockpluscore/lib/snippets.js";

import {filterEngine} from "./core.js";
import {getFrameInfo} from "./frame-state.js";
import {logItem, tracingEnabled} from "./diagnostics.js";
import {debugOptions} from "./debugging.js";

let isolatedLib;
let injectedLib;

export function setSnippetLibrary({isolatedCode, injectedCode}) {
  isolatedLib = isolatedCode;
  injectedLib = injectedCode;
}

function generateStylesheet(tabId, frame) {
  let specificOnly = (frame.allowlisted & contentTypes.GENERICHIDE) != 0;
  let trace = tracingEnabled(tabId);
  let styleSheet = filterEngine.elemHide.getStyleSheet(
    frame.hostname,
    specificOnly, trace || debugOptions.elemHide,
    trace
  );

  if (debugOptions.elemHide) {
    let declarationBlock = "{";
    for (let [property, value] of debugOptions.cssProperties)
      declarationBlock += `${property}: ${value} !important;`;
    declarationBlock += "}";

    styleSheet.code = createStyleSheet(styleSheet.selectors, declarationBlock);
  }

  return styleSheet;
}

export async function removeContentFilters(tabId, frameId, frame) {
  if (frame.allowlisted & contentTypes.DOCUMENT)
    return;

  if (!(frame.allowlisted & contentTypes.ELEMHIDE)) {
    let styleSheet = generateStylesheet(tabId, frame);
    await removeCSS(tabId, frameId, styleSheet.code);
  }
}

export async function applyContentFilters(tabId, frameId) {
  let frame = getFrameInfo(tabId, frameId);
  let details = {tabId, frameIds: [frameId]};
  let emulatedPatterns = [];
  let tracedSelectors;

  if (!(frame.allowlisted & contentTypes.DOCUMENT)) {
    let filters = filterEngine.snippets.getFilters(frame.hostname);

    if (filters.length > 0) {
      let scripts = filters.map(({script}) => script);
      let environment = {};
      if (debugOptions.elemHide)
        environment.debugCSSProperties = debugOptions.snippetsCssProperties;

      let isolatedDependencies = [];
      let isolated = [];
      let main = [];

      for (let script of scripts) {
        for (let [snippet, ...args] of parseScript(script)) {
          if (isolatedLib.has(snippet)) {
            let dependency = isolatedLib.get(snippet);
            if (dependency)
              isolatedDependencies.push(dependency);
            isolated.push([snippet, ...args]);
          }
          if (injectedLib.has(snippet))
            main.push([snippet, ...args]);
        }
      }

      let execute = [];
      if (browser.scripting && browser.scripting.executeScript) {
        if (isolated.length > 0) {
          if (isolatedDependencies.length) {
            let isolatedDepsPromises = [];
            for (let dependency of isolatedDependencies) {
              isolatedDepsPromises.push(browser.scripting.executeScript({
                target: details,
                world: "ISOLATED",
                func: dependency
              }));
            }
            await Promise.all(isolatedDepsPromises);
          }

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
          let code = "";
          // prepend all dependencies before the snippets
          if (isolatedDependencies.length) {
            for (const cb of isolatedDependencies)
              code += `(${cb})();`;
          }
          code += `(${isolatedLib}).apply(null,${args})`;
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
          // stringify injectedLib to escape backticks
          let code = JSON.stringify(injectedLib.toString());
          code = `"(${code.slice(1, -1)}).apply(null,${JSON.stringify(args).slice(1, -1)});"`;
          let executable =
          `function injectSnippetsInMainContext(executable)
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
          {
            const executable = ${code};
            injectSnippetsInMainContext(executable);
          }`;
          execute.push(
            browser.tabs.executeScript(
              tabId,
              {
                frameId,
                code: executable,
                matchAboutBlank: true,
                runAt: "document_start"
              }));
        }
      }

      let request = {tabId, frameId, url: frame.url};
      Promise.all(execute).then(() => filters.forEach(filter => {
        logItem(request, filter, {
          docDomain: frame.hostname,
          method: "snippet"
        });
      }), () => {});
    }

    if (!(frame.allowlisted & contentTypes.ELEMHIDE)) {
      let styleSheet = generateStylesheet(tabId, frame);
      injectCSS(tabId, frameId, styleSheet.code);

      for (let {selector, text} of filterEngine.elemHideEmulation.getFilters(
        frame.hostname))
        emulatedPatterns.push({selector, text});

      if (tracingEnabled(tabId)) {
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

export async function removeCSS(tabId, frameId, code) {
  let result;

  if (browser.scripting && browser.scripting.removeCSS) {
    result = browser.scripting.removeCSS({
      target: {tabId, frameIds: [frameId]},
      css: code,
      origin: "USER"
    });
  }
  else if (browser.tabs.removeCSS) {
    result = browser.tabs.removeCSS(
      tabId,
      {
        code,
        cssOrigin: "user",
        frameId,
        matchAboutBlank: true
      }
    );
  }
  else {
    result = Promise.resolve();
  }

  try {
    await result;
  }
  catch (e) {
    // Fails if tab or frame no longer exists
  }
}
