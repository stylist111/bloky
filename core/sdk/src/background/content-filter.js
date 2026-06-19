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

import browser from "./browser.js";

import {createStyleSheet} from "#adblockpluscore/lib/elemHide.js";
import {contentTypes} from "#adblockpluscore/lib/contentTypes.js";
import {parseScript} from "#adblockpluscore/lib/snippets.js";

import {filterEngine} from "./core.js";
import {getFrameInfo} from "./frame-state.js";
import {tracingEnabled} from "./diagnostics.js";
import {debugOptions, trace, debug, warn} from "./debugging.js";
import {arraysDiff, objectArraysDiff} from "./set-operations.js";
import {shouldNotifyActive} from "./cdp/index.js";
import {patchSender as patchHistoryApi} from "./safari-history.js";
import {isSafari} from "./info.js";
import dependencySnippets from "@eyeo/snippets/isolated/heavy";
import {DEBUG_CSS_PROPERTIES} from "../all/snippets.js";


// Normally snippets are injected in the content script but some of them are
// very large and only needed very rarely. Injecting them in the background 
// worker instead of the content script saves us from injecting ~350 KB
// per frame unconditionally. This function injects them only if they are used.
// This also means that these snippets might run after the page scripts.
// That is acceptable for the snippets in the isolated/heavy artifact. 
async function injectHeavySnippets(tabId, frameId, hostname) {
  const snippetFilters = filterEngine.snippets.getFilters(hostname);
  const isolated = [];
  const dependencies = new Set();
  for (const {body} of snippetFilters) {
    for (const script of parseScript(body)) {
      if (dependencySnippets.has(script[0])) {
        isolated.push(script);
        const dep = dependencySnippets.get(script[0]);
        if (dep) {
          dependencies.add(dep);
        }
      }
    }
  }

  // Only inject the script if there is a filter that requires the dependency.
  // The helper snippets such as debug; and profile; exist in the artifact.
  // They only exist to help debug the heavy snippet.
  // We don't want to inject the heavy snippet if only helper snippets are used.
  // That's why we don't look at the isolated.length here but look at the
  // dependencies.size instead.
  if (!dependencies.size) {
    return;
  }

  // Telemetry events are not supported for heavy snippets for now.
  const environment = {};
  if (debugOptions.elemHide) {
    environment.debugCSSProperties = DEBUG_CSS_PROPERTIES;
  }

  try {
    if (browser.scripting && browser.scripting.executeScript) {
      const target = {tabId, frameIds: [frameId]};
      await Promise.all([...dependencies].map(dep =>
        browser.scripting.executeScript({
          target,
          world: "ISOLATED",
          func: dep
        })
      ));
      await browser.scripting.executeScript({
        target,
        world: "ISOLATED",
        func: dependencySnippets,
        args: [environment, ...isolated]
      });
    }
    else if (browser.tabs && browser.tabs.executeScript) {
      const args = JSON.stringify([environment, ...isolated]);
      let code = "";
      for (const dep of dependencies) {
        code += `(${dep})();`;
      }
      code += `(${dependencySnippets}).apply(null,${args})`;
      await browser.tabs.executeScript(
        tabId,
        {
          frameId,
          code,
          matchAboutBlank: true,
          runAt: "document_start"
        }
      );
    }
  }
  catch (e) {
    // Frame may have navigated away; don't let injection failures break
    // the rest of applyContentFilters.
  }
}

function calculateSelectorsDiff(previousStylesheet, styleSheet) {
  let diff = arraysDiff(previousStylesheet.selectors, styleSheet.selectors);
  styleSheet.removedSelectors = diff.removed;
  styleSheet.addedSelectors = diff.added;

  let inlineDiff = objectArraysDiff(
    previousStylesheet.inlineCssRules,
    styleSheet.inlineCssRules
  );
  styleSheet.removedInlineCssRules = inlineDiff.removed;
  styleSheet.addedInlineCssRules = inlineDiff.added;

  styleSheet.removedCode = createStyleSheet(
    styleSheet.removedSelectors,
    styleSheet.removedInlineCssRules
  );
  styleSheet.addedCode = createStyleSheet(
    styleSheet.addedSelectors,
    styleSheet.addedInlineCssRules
  );
}

function generateStylesheet(tabId, previousFrame, frame) {
  let specificOnly = (frame.allowlisted & contentTypes.GENERICHIDE) != 0;
  let tracing = tracingEnabled(tabId);

  let previousStylesheet;
  if (previousFrame &&
      !(previousFrame.allowlisted & contentTypes.DOCUMENT) &&
      !(previousFrame.allowlisted & contentTypes.ELEMHIDE)) {
    previousStylesheet = filterEngine.elemHide.getStyleSheet(
      previousFrame.hostname,
      specificOnly,
      tracing);
  }
  else {
    previousStylesheet = {
      selectors: [],
      inlineCssRules: []
    };
  }

  let styleSheet;
  if (!(frame.allowlisted & contentTypes.DOCUMENT) &&
      !(frame.allowlisted & contentTypes.ELEMHIDE)) {
    styleSheet = filterEngine.elemHide.getStyleSheet(
      frame.hostname,
      specificOnly,
      trace);
  }
  else {
    styleSheet = {
      selectors: [],
      inlineCssRules: []
    };
  }

  calculateSelectorsDiff(previousStylesheet, styleSheet);

  if (debugOptions.elemHide) {
    let declarationBlock = "{";
    for (let [property, value] of debugOptions.cssProperties) {
      declarationBlock += `${property}: ${value} !important;`;
    }
    declarationBlock += "}";

    styleSheet.code = createStyleSheet(
      styleSheet.selectors,
      styleSheet.inlineCssRules,
      declarationBlock
    );
    styleSheet.removedCode = createStyleSheet(
      styleSheet.removedSelectors,
      styleSheet.removedInlineCssRules,
      declarationBlock
    );
    styleSheet.addedCode = createStyleSheet(
      styleSheet.addedSelectors,
      styleSheet.addedInlineCssRules,
      declarationBlock
    );
  }

  return styleSheet;
}

export async function applyContentFilters(
  tabId, frameId, previousFrame, skipSnippets) {
  const frame = getFrameInfo(tabId, frameId);
  trace({tabId, frameId, previousFrame, frame});
  const emulatedPatterns = [];
  let tracedSelectors;

  if (frame) {
    let styleSheet = generateStylesheet(tabId, previousFrame, frame);
    debug(() => JSON.stringify(styleSheet));

    if (previousFrame && !(previousFrame.allowlisted & contentTypes.DOCUMENT)) {
      await removeCSS(tabId, frameId, styleSheet.removedCode);
    }

    if (
      !skipSnippets &&
      !(frame.allowlisted & contentTypes.DOCUMENT)
    ) {
      if (isSafari()) {
        console.warn("Patching history API sender");
        patchHistoryApi({tabId, frameIds: [frameId]});
      }

      // Not awaiting here as we don't need to block the CSS injection.
      injectHeavySnippets(tabId, frameId, frame.hostname);
    }

    if (!(frame.allowlisted & contentTypes.DOCUMENT) &&
      !(frame.allowlisted & contentTypes.ELEMHIDE)) {
      injectCSS(tabId, frameId, styleSheet.addedCode);

      let filters = filterEngine.elemHideEmulation.getFilters(frame.hostname);
      for (const {selector, text, remove, css} of filters) {
        emulatedPatterns.push({selector, text, remove, css});
      }

      if (tracingEnabled(tabId)) {
        tracedSelectors = [];
        for (let selector of styleSheet.addedSelectors) {
          tracedSelectors.push([selector, null]);
        }
        for (let rule of styleSheet.addedInlineCssRules) {
          tracedSelectors.push([rule.selector, null]);
        }
        for (let exception of styleSheet.exceptions) {
          tracedSelectors.push([exception.selector, exception.text]);
        }
      }
    }
  }
  else {
    warn("No frame info");
  }

  let cssProperties;
  if (debugOptions.elemHide) {
    cssProperties = debugOptions.cssProperties;
  }

  const notifyActive = shouldNotifyActive(tabId, frameId);

  return {emulatedPatterns, cssProperties, tracedSelectors, notifyActive};
}

export function injectCSS(tabId, frameId, code) {
  let result;

  // Safari-specific: Try browser.tabs.insertCSS first as it may be more
  // reliable on some Safari versions. If that fails, fall back to
  // browser.scripting.insertCSS
  if (isSafari()) {
    if (browser.tabs && browser.tabs.insertCSS) {
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
    else if (browser.scripting && browser.scripting.insertCSS) {
      // Safari doesn't properly apply USER origin CSS, use AUTHOR instead
      result = browser.scripting.insertCSS({
        target: {tabId, frameIds: [frameId]},
        css: code,
        origin: "AUTHOR"
      });
    }
    else {
      return;
    }
  }
  else if (browser.scripting && browser.scripting.insertCSS) {
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

  result.catch(() => {
    // Safari fallback: If scripting.insertCSS failed, try tabs.insertCSS
    if (isSafari() && browser.tabs && browser.tabs.insertCSS) {
      browser.tabs.insertCSS(
        tabId,
        {
          code,
          cssOrigin: "user",
          frameId,
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});
    }
  });
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
