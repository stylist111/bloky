import browser from "webextension-polyfill";

import {elemHide} from "../../adblockpluscore/lib/elemHide.js";
import {elemHideEmulation}
  from "../../adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {snippets, compileScript} from "../../adblockpluscore/lib/snippets.js";
import snippetsLibrarySource
  from "raw-loader!../../adblockpluscore/lib/content/snippets.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";

export function applyContentFilters(tabId, frameId)
{
  let emulatedPatterns = [];

  if (!isAllowlisted(tabId, frameId))
  {
    let {docDomain} = getMatchContext(tabId, frameId);
    let filters = snippets.getFilters(docDomain);

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

    if (!isAllowlisted(tabId, frameId, contentTypes.ELEMHIDE))
    {
      let specificOnly = isAllowlisted(tabId, frameId,
                                       contentTypes.GENERICHIDE);
      let {code} = elemHide.getStyleSheet(docDomain, specificOnly);

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

      for (let {selector, text} of elemHideEmulation.getFilters(docDomain))
        emulatedPatterns.push({selector, text});
    }
  }

  return emulatedPatterns;
}
