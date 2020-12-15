import browser from "webextension-polyfill";

import {elemHide} from "../adblockpluscore/lib/elemHide.js";
import {elemHideEmulation} from "../adblockpluscore/lib/elemHideEmulation.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";
import {snippets, compileScript} from "../adblockpluscore/lib/snippets.js";
import snippetsLibrarySource
  from "raw-loader!../adblockpluscore/lib/content/snippets.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";

function onMessage(message, sender)
{
  if (typeof message != "object" || message.type != "abp:apply-content-filters")
    return;

  let response = {emulatedPatterns: []};

  if (!isAllowlisted(sender.tab.id, sender.frameId))
  {
    let {docDomain} = getMatchContext(sender.tab.id, sender.frameId);
    let filters = snippets.getFilters(docDomain);

    if (filters.length > 0)
    {
      let scripts = filters.filter(ok => ok).map(({script}) => script);
      browser.tabs.executeScript(
        sender.tab.id,
        {
          frameId: sender.frameId,
          code: compileScript(scripts, [snippetsLibrarySource]),
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});
    }

    if (!isAllowlisted(sender.tab.id, sender.frameId, contentTypes.ELEMHIDE))
    {
      let specificOnly = isAllowlisted(sender.tab.id, sender.frameId,
                                       contentTypes.GENERICHIDE);
      let {code} = elemHide.getStyleSheet(docDomain, specificOnly);

      browser.tabs.insertCSS(
        sender.tab.id,
        {
          code,
          cssOrigin: "user",
          frameId: sender.frameId,
          matchAboutBlank: true,
          runAt: "document_start"
        }
      ).catch(() => {});  // Fails if tab or frame no longer exists

      for (let {selector, text} of elemHideEmulation.getFilters(docDomain))
        response.emulatedPatterns.push({selector, text});
    }
  }

  return Promise.resolve(response);
}

export function start()
{
  browser.runtime.onMessage.addListener(onMessage);
}

export function stop()
{
  browser.runtime.onMessage.removeListener(onMessage);
}
