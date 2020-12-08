import browser from "webextension-polyfill";

import {elemHide} from "../adblockpluscore/lib/elemHide.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";

function onMessage(message, sender)
{
  if (typeof message != "object" || message.type != "abp:apply-content-filters")
    return;

  if (isAllowlisted(sender.tab.id, sender.frameId,
                    contentTypes.DOCUMENT | contentTypes.ELEMHIDE))
    return;

  let {docDomain} = getMatchContext(sender.tab.id, sender.frameId);
  let specificOnly = isAllowlisted(sender.tab.id, sender.frameId,
                                   contentTypes.GENERICHIDE);
  let {code} = elemHide.getStyleSheet(docDomain, specificOnly);

  browser.tabs.insertCSS(sender.tab.id, {
    code,
    cssOrigin: "user",
    frameId: sender.frameId,
    matchAboutBlank: true,
    runAt: "document_start"
  });
}

export function startContentFiltering()
{
  browser.runtime.onMessage.addListener(onMessage);
}

export function stopContentFiltering()
{
  browser.runtime.onMessage.removeListener(onMessage);
}
