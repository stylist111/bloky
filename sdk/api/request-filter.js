import browser from "webextension-polyfill";

import {BlockingFilter} from "../../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {defaultMatcher as matcher} from "../../adblockpluscore/lib/matcher.js";
import {filterNotifier} from "../../adblockpluscore/lib/filterNotifier.js";

import {getFrameInfo} from "./frame-state.js";
import {ignoreNoConnectionError} from "../errors.js";
import {logItem} from "./diagnostics.js";

const EXTENSION_PROTOCOL = new URL(browser.runtime.getURL("")).protocol;

let resourceTypes = new Map();
for (let type in contentTypes)
  resourceTypes.set(type.toLowerCase(), contentTypes[type]);
resourceTypes.set("sub_frame", contentTypes.SUBDOCUMENT);
resourceTypes.set("beacon", contentTypes.PING);
resourceTypes.set("imageset", contentTypes.IMAGE);
resourceTypes.set("object_subrequest", contentTypes.OBJECT);

let typeSelectors = new Map([
  [contentTypes.IMAGE, "img,input"],
  [contentTypes.MEDIA, "audio,video"],
  [contentTypes.SUBDOCUMENT, "frame,iframe,object,embed"],
  [contentTypes.OBJECT, "object,embed"]
]);

class RequestFilter
{
  register()
  {
    if (!this.listener)
    {
      this.listener = this.filter.bind(this);
      this.event.addListener(this.listener, ...this.eventArgs);
    }
  }

  unregister()
  {
    if (this.listener)
    {
      this.event.removeListener(this.listener);
      this.listener = null;
    }
  }

  getFrameId(details)
  {
    return details.type == "sub_frame" ? details.parentFrameId :
                                         details.frameId;
  }

  getFrameInfo(details, initiator)
  {
    return getFrameInfo(details.tabId, this.getFrameId(details), initiator);
  }

  getContentType(details)
  {
    return resourceTypes.get(details.type) || contentTypes.OTHER;
  }

  collapse(details)
  {
    let selector = typeSelectors.get(this.getContentType(details));
    let frameId = this.getFrameId(details);

    if (selector && frameId != -1)
    {
      ignoreNoConnectionError(browser.tabs.sendMessage(
        details.tabId,
        {type: "abp:collapse", selector, url: details.url}, {frameId}
      ));
    }
  }

  isBlocking(details, filter)
  {
    if (filter)
    {
      if (filter instanceof BlockingFilter)
        return true;

      logItem(details, filter);
    }
    return false;
  }

  block(details, filter)
  {
    logItem(details, filter);

    if (typeof filter.rewrite == "string")
    {
      let redirectUrl = filter.rewriteUrl(details.url);
      // If no rewrite happened (error, different origin), we'll
      // return undefined in order to avoid an "infinite" loop.
      if (redirectUrl != details.url)
        return {redirectUrl};
    }
    else
    {
      this.collapse(details);
      return {cancel: true};
    }
  }

  match(details, frame, specificOnly)
  {
    let filter = matcher.match(details.url, this.getContentType(details),
                               frame.hostname, frame.sitekey, specificOnly);

    if (this.isBlocking(details, filter))
      return this.block(details, filter);
  }

  filter(details)
  {
    let initiator = details.initiator || details.documentUrl;
    if (initiator && initiator.startsWith(EXTENSION_PROTOCOL))
      return;

    let frame = this.getFrameInfo(details, initiator);
    if (frame.allowlisted & contentTypes.DOCUMENT)
      return;

    let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
    return this.match(details, frame, specificOnly);
  }
}

RequestFilter.prototype.event = browser.webRequest.onBeforeRequest;
RequestFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType)
                 .filter(type => type != "main_frame"),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  },
  ["blocking"]
];

class HeaderFilter extends RequestFilter
{
  match(details, frame, specificOnly)
  {
    let typeMask = contentTypes.HEADER | this.getContentType(details);
    if (!this.isBlocking(details, matcher.match(details.url, typeMask,
                                                frame.hostname, frame.sitekey,
                                                specificOnly)))
      return;

    let matches = matcher.search(details.url, contentTypes.HEADER,
                                 frame.hostname, frame.sitekey,
                                 specificOnly, "blocking");

    for (let filter of matches.blocking)
    {
      if (filter.filterHeaders(details.responseHeaders))
        return this.block(details, filter);
    }
  }
}

HeaderFilter.prototype.event = browser.webRequest.onHeadersReceived;
HeaderFilter.prototype.eventArgs = [
  {
    types: Object.values(browser.webRequest.ResourceType)
                 .filter(type => type != "main_frame"),
    urls: ["http://*/*", "https://*/*"]
  },
  ["blocking", "responseHeaders"]
];

class CSPFilter extends RequestFilter
{
  getFrameInfo(details)
  {
    return getFrameInfo(details.tabId, details.frameId).pending;
  }

  match(details, frame, specificOnly)
  {
    let parentFrame = getFrameInfo(details.tabId, details.parentFrameId);
    let docDomain = parentFrame && parentFrame.hostname;

    if (!this.isBlocking(details, matcher.match(details.url, contentTypes.CSP,
                                                docDomain, frame.sitekey,
                                                specificOnly)))
      return;

    let {responseHeaders} = details;
    let matches = matcher.search(details.url, contentTypes.CSP, docDomain,
                                 frame.sitekey, specificOnly, "blocking");

    for (let filter of matches.blocking)
    {
      logItem(details, filter);
      responseHeaders.push(
        {name: "Content-Security-Policy", value: filter.csp}
      );
    }

    return {responseHeaders};
  }
}

CSPFilter.prototype.event = browser.webRequest.onHeadersReceived;
CSPFilter.prototype.eventArgs = [
  {
    types: ["main_frame", "sub_frame"],
    urls: ["http://*/*", "https://*/*"]
  },
  ["blocking", "responseHeaders"]
];

let filters = [new RequestFilter(), new HeaderFilter(), new CSPFilter()];

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
  for (let filter of filters)
    filter.register();

  for (let event of FILTER_EVENTS)
  {
    if (!filterNotifier.listeners(event).includes(onFilterChange))
      filterNotifier.on(event, onFilterChange);
  }
}

export function stop()
{
  for (let filter of filters)
    filter.unregister();

  for (let event of FILTER_EVENTS)
    filterNotifier.off(event, onFilterChange);
}
