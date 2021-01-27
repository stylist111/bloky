import browser from "webextension-polyfill";

import {BlockingFilter} from "../../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {defaultMatcher as matcher} from "../../adblockpluscore/lib/matcher.js";
import {filterNotifier} from "../../adblockpluscore/lib/filterNotifier.js";

import {getFrameInfo} from "./frame-state.js";
import {ignoreNoConnectionError} from "../errors.js";

const EXTENSION_PROTOCOL = new URL(browser.runtime.getURL("")).protocol;

// Map of content types reported by the browser to the respecitve content types
// used by Adblock Plus. Other content types are simply mapped to OTHER.
let resourceTypes = new Map();
for (let type in contentTypes)
  resourceTypes.set(type.toLowerCase(), type);
resourceTypes.set("sub_frame", "SUBDOCUMENT");
resourceTypes.set("beacon", "PING");
resourceTypes.set("imageset", "IMAGE");
resourceTypes.set("object_subrequest", "OBJECT");

let typeSelectors = new Map([
  ["IMAGE", "img,input"],
  ["MEDIA", "audio,video"],
  ["SUBDOCUMENT", "frame,iframe,object,embed"],
  ["OBJECT", "object,embed"]
]);

function collapse(tabId, frameId, type, url)
{
  let selector = typeSelectors.get(type);
  if (selector && frameId != -1)
  {
    ignoreNoConnectionError(browser.tabs.sendMessage(
      tabId, {type: "abp:collapse", selector, url}, {frameId}
    ));
  }
}

function onBeforeRequest(details)
{
  let initiator = details.initiator || details.documentUrl;
  if (initiator.startsWith(EXTENSION_PROTOCOL))
    return;

  // We are looking for the frame that contains the element which
  // has triggered this request. For most requests (e.g. images) we
  // can just use the request's frame ID, but for subdocument requests
  // (e.g. iframes) we must instead use the request's parent frame ID.
  let frameId = details.type == "sub_frame" ? details.parentFrameId :
                                              details.frameId;

  let frame = getFrameInfo(details.tabId, frameId, initiator);
  if (frame.allowlisted & contentTypes.DOCUMENT)
    return;

  let type = resourceTypes.get(details.type) || "OTHER";
  let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
  let filter = matcher.match(details.url, contentTypes[type],
                             frame.hostname, frame.sitekey, specificOnly);

  if (filter instanceof BlockingFilter)
  {
    if (typeof filter.rewrite == "string")
    {
      let rewrittenUrl = filter.rewriteUrl(details.url);
      // If no rewrite happened (error, different origin), we'll
      // return undefined in order to avoid an "infinite" loop.
      if (rewrittenUrl != details.url)
        return {redirectUrl: rewrittenUrl};
    }
    else
    {
      collapse(details.tabId, frameId, type, details.url);
      return {cancel: true};
    }
  }
}

function onHeadersReceived(details)
{
  let frame = getFrameInfo(details.tabId, details.frameId).pending;

  if (frame.allowlisted & contentTypes.DOCUMENT)
    return;

  let parentFrame = getFrameInfo(details.tabId, details.parentFrameId);
  let docDomain = parentFrame && parentFrame.hostname;
  let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;

  if (!(matcher.match(details.url, contentTypes.CSP, docDomain,
                      frame.sitekey, specificOnly) instanceof BlockingFilter))
    return;

  let matches = matcher.search(details.url, contentTypes.CSP, docDomain,
                               frame.sitekey, specificOnly, "blocking");

  for (let {csp} of matches.blocking)
    details.responseHeaders.push({name: "Content-Security-Policy", value: csp});

  return {responseHeaders: details.responseHeaders};
}

function onBeforeNavigate()
{
  browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  browser.webRequest.handlerBehaviorChanged();
}

function onFilterChange()
{
  browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
}

const FILTER_EVENTS = ["subscription.added",
                       "subscription.removed",
                       "subscription.updated",
                       "subscription.disabled",
                       "filter.added",
                       "filter.removed",
                       "filterState.enabled"];

export function start()
{
  if (!browser.webRequest.onBeforeRequest.hasListener(onBeforeRequest))
  {
    browser.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      {
        types: Object.values(browser.webRequest.ResourceType)
                     .filter(type => type != "main_frame"),
        urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
      },
      ["blocking"]
    );
  }

  if (!browser.webRequest.onHeadersReceived.hasListener(onHeadersReceived))
  {
    browser.webRequest.onHeadersReceived.addListener(
      onHeadersReceived,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame", "sub_frame"]
      },
      ["blocking", "responseHeaders"]
    );
  }

  for (let event of FILTER_EVENTS)
  {
    if (!filterNotifier.listeners(event).includes(onFilterChange))
      filterNotifier.on(event, onFilterChange);
  }
}

export function stop()
{
  browser.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);

  for (let event of FILTER_EVENTS)
    filterNotifier.off(event, onFilterChange);
}
