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

import {filterEngine} from "./core.js";
import {getFrameInfo} from "./frame-state.js";
import {tracingEnabled} from "./diagnostics.js";
import {debugOptions, trace, debug, warn} from "./debugging.js";
import {arraysDiff} from "./set-operations.js";
import {shouldNotifyActive} from "./cdp/index.js";
import {patchSender as patchHistoryApi} from "./safari-history.js";
import {isSafari} from "./info.js";

function calculateSelectorsDiff(previousStylesheet, styleSheet) {
  let diff = arraysDiff(previousStylesheet.selectors, styleSheet.selectors);
  styleSheet.removedSelectors = diff.removed;
  styleSheet.addedSelectors = diff.added;

  styleSheet.removedCode = createStyleSheet(styleSheet.removedSelectors);
  styleSheet.addedCode = createStyleSheet(styleSheet.addedSelectors);
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
      selectors: []
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
      selectors: []
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
      styleSheet.selectors, declarationBlock);
    styleSheet.removedCode = createStyleSheet(
      styleSheet.removedSelectors, declarationBlock);
    styleSheet.addedCode = createStyleSheet(
      styleSheet.addedSelectors, declarationBlock);
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
      !(frame.allowlisted & contentTypes.DOCUMENT) &&
      isSafari()
    ) {
      console.warn("Patching history API sender");
      patchHistoryApi({tabId, frameIds: [frameId]});
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
