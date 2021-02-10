import browser from "webextension-polyfill";

import {elemHide} from "../../adblockpluscore/lib/elemHide.js";
import {elemHideEmulation}
  from "../../adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {snippets, compileScript} from "../../adblockpluscore/lib/snippets.js";
import snippetsLibrarySource
  from "raw-loader!../../adblockpluscore/lib/content/snippets.js";

import {getFrameInfo} from "./frame-state.js";
import {logItem, tracingEnabled} from "./diagnostics.js";

export function applyContentFilters(tabId, frameId)
{
  let frame = getFrameInfo(tabId, frameId);
  let emulatedPatterns = [];
  let tracedSelectors;

  if (!(frame.allowlisted & contentTypes.DOCUMENT))
  {
    let filters = snippets.getFilters(frame.hostname);

    if (filters.length > 0)
    {
      let scripts = filters.map(({script}) => script);
      browser.tabs.executeScript(
        tabId,
        {
          frameId,
          code: compileScript(scripts, [snippetsLibrarySource]),
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
                                              specificOnly, trace, trace);

      browser.tabs.insertCSS(
        tabId,
        {
          code: styleSheet.code,
          cssOrigin: "user",
          frameId,
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});  // Fails if tab or frame no longer exists

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

  return {emulatedPatterns, tracedSelectors};
}
