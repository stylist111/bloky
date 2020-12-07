import browser from "webextension-polyfill";

import {elemHide} from "../adblockpluscore/lib/elemHide.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";

browser.runtime.onMessage.addListener((message, sender) =>
{
  if (typeof message != "object" || message.type != "abp:apply-content-filters")
    return;

  if (isAllowlisted(sender.tab.id, sender.frameId,
                    contentTypes.DOCUMENT | contentTypes.ELEMHIDE))
    return;

  let {docDomain} = getMatchContext(sender.tab.id, sender.frameId);
  let specificOnly = isAllowlisted(sender.tab.id, sender.frameId,
                                   contentTypes.GENERICHIDE);
  let styleSheet = elemHide.getStyleSheet(docDomain, specificOnly);

  /* eslint-disable-next-line no-console */
  console.log(styleSheet);
});
