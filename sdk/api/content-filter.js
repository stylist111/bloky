import browser from "webextension-polyfill";

import {elemHide} from "../../adblockpluscore/lib/elemHide.js";
import {elemHideEmulation}
  from "../../adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {snippets, compileScript} from "../../adblockpluscore/lib/snippets.js";
import snippetsLibrarySource
  from "raw-loader!../../adblockpluscore/lib/content/snippets.js";

import {getFrameInfo} from "./frame-state.js";

export function applyContentFilters(tabId, frameId)
{
  let emulatedPatterns = [];
  let frame = getFrameInfo(tabId, frameId);

  if (!(frame.allowlisted & contentTypes.DOCUMENT))
  {
    let filters = snippets.getFilters(frame.hostname);

    if (filters.length > 0)
    {
      let scripts = filters.filter(ok => ok).map(({script}) => script);
      browser.tabs.executeScript(
        tabId,
        {
          frameId,
          code: compileScript(scripts, [snippetsLibrarySource]),
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});
    }

    if (!(frame.allowlisted & contentTypes.ELEMHIDE))
    {
      let specificOnly = (frame.allowlisted & contentTypes.GENERICHIDE) != 0;
      let {code} = elemHide.getStyleSheet(frame.hostname, specificOnly);

      browser.tabs.insertCSS(
        tabId,
        {
          code,
          cssOrigin: "user",
          frameId,
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});  // Fails if tab or frame no longer exists

      for (let {selector, text} of elemHideEmulation.getFilters(frame.hostname))
        emulatedPatterns.push({selector, text});
    }
  }

  return emulatedPatterns;
}
