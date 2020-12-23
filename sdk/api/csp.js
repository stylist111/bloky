import browser from "webextension-polyfill";

import {defaultMatcher} from "../../adblockpluscore/lib/matcher.js";
import {BlockingFilter} from "../../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";

import {isAllowlisted, getMatchContext, getSitekeyFromHeaders}
  from "./frame-state.js";

function isRequestAllowlisted(request, typeMask, docDomain, sitekey)
{
  return !!defaultMatcher.match(request.url, typeMask, docDomain, sitekey) ||
         isAllowlisted(request.tabId, request.parentFrameId, typeMask);
}

function onHeadersReceived(details)
{
  let {sitekey: parentSitekey,
       docDomain} = getMatchContext(details.tabId, details.parentFrameId);
  let sitekey = getSitekeyFromHeaders(details.responseHeaders,
                                      details.url) || parentSitekey;

  if (!(defaultMatcher.match(details.url, contentTypes.CSP, docDomain,
                             sitekey, false) instanceof BlockingFilter))
    return;

  if (isRequestAllowlisted(details, contentTypes.DOCUMENT, docDomain, sitekey))
    return;

  let specificOnly = isRequestAllowlisted(details, contentTypes.GENERICBLOCK,
                                          docDomain, sitekey);
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
