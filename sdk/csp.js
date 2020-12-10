import browser from "webextension-polyfill";

import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {BlockingFilter} from "../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";

function onHeadersReceived(details)
{
  let {docDomain, sitekey} = getMatchContext(details.tabId,
                                             details.parentFrameId);
  let filter = defaultMatcher.match(details.url, contentTypes.CSP,
                                    docDomain, sitekey, false);

  if (!filter || isAllowlisted(details.tabId, details.frameId))
    return;

  // To avoid an extra match for the common case we assumed no
  // $genericblock filters applied when searching for a matching $csp filter.
  // We must now pay the price by first checking for a $genericblock filter
  // and if necessary that our $csp filter is specific.
  let specificOnly = isAllowlisted(details.tabId, details.frameId,
                                   contentTypes.GENERICBLOCK);
  if (specificOnly && filter instanceof BlockingFilter)
  {
    filter = defaultMatcher.match(details.url, contentTypes.CSP,
                                  docDomain, sitekey, true);
  }

  if (!(filter instanceof BlockingFilter))
    return;

  let matches = defaultMatcher.search(details.url, contentTypes.CSP, docDomain,
                                      sitekey, specificOnly, "blocking");
  for (let {csp} of matches.blocking)
    details.responseHeaders.push({name: "Content-Security-Policy", value: csp});

  return {responseHeaders: details.responseHeaders};
}

export function start()
{
  if (browser.webRequest.onHeadersReceived.hasListener(onHeadersReceived))
    return;

  browser.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame", "sub_frame"]
    },
    ["blocking", "responseHeaders"]
  );
}

export function stop()
{
  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
}
