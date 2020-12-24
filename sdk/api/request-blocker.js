import browser from "webextension-polyfill";

import {BlockingFilter} from "../../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {defaultMatcher} from "../../adblockpluscore/lib/matcher.js";
import {filterNotifier} from "../../adblockpluscore/lib/filterNotifier.js";

import {isAllowlisted, getMatchContext} from "./frame-state.js";
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
  // Firefox provides us with the full origin URL, while Chromium (>=63)
  // provides only the protocol + host of the (top-level) document which
  // the request originates from through the "initiator" property.
  let originUrl = null;
  if (details.originUrl)
    originUrl = details.originUrl;
  else if (details.initiator && details.initiator != "null")
    originUrl = details.initiator;

  // Ignore requests sent by extensions or by Firefox itself:
  // * Firefox intercepts requests sent by any extensions, indicated with
  //   an "originUrl" starting with "moz-extension:".
  // * Chromium intercepts requests sent by this extension only, indicated
  //   on Chromium >=63 with an "initiator" starting with "chrome-extension:".
  // * On Firefox, requests that don't relate to any document or extension are
  //   indicated with an "originUrl" starting with "chrome:".
  if (originUrl && (originUrl.startsWith(EXTENSION_PROTOCOL) ||
                    originUrl.startsWith("chrome:")))
    return;

  // We are looking for the frame that contains the element which
  // has triggered this request. For most requests (e.g. images) we
  // can just use the request's frame ID, but for subdocument requests
  // (e.g. iframes) we must instead use the request's parent frame ID.
  let frameId = details.type == "sub_frame" ? details.parentFrameId :
                                              details.frameId;

  if (isAllowlisted(details.tabId, frameId))
    return;

  let type = resourceTypes.get(details.type) || "OTHER";
  let {docDomain, sitekey} = getMatchContext(details.tabId, frameId);
  let specificOnly = isAllowlisted(details.tabId,
                                   frameId, contentTypes.GENERICBLOCK);

  let filter = defaultMatcher.match(details.url, contentTypes[type],
                                    docDomain, sitekey, specificOnly);

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
  if (browser.webRequest.onBeforeRequest.hasListener(onBeforeRequest))
    return;

  browser.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    {
      types: Object.values(browser.webRequest.ResourceType)
                   .filter(type => type != "main_frame"),
      urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
    },
    ["blocking"]
  );

  for (let event of FILTER_EVENTS)
    filterNotifier.on(event, onFilterChange);
}

export function stop()
{
  browser.webRequest.onBeforeRequest.removeListener(onBeforeRequest);

  for (let event of FILTER_EVENTS)
    filterNotifier.off(event, onFilterChange);
}
