import browser from "webextension-polyfill";

import {parseURL} from "../../adblockpluscore/lib/url.js";
import {defaultMatcher as matcher} from "../../adblockpluscore/lib/matcher.js";
import {ALLOWING_TYPES} from "../../adblockpluscore/lib/contentTypes.js";
import {verifySignature} from "../../adblockpluscore/lib/rsa.js";

let state = new Map();
let startupPromise;

class FrameInfo
{
  constructor(parent, url, pending)
  {
    let hostname;
    let sitekey;
    let allowlisted = 0;
    let urlInfo = parseURL(url);

    if (pending && pending.url != url)
      pending = null;

    if (!pending && (urlInfo.protocol == "http:" ||
                     urlInfo.protocol == "https:"))
      pending = new PendingFrameInfo(parent, url);

    if (pending)
    {
      ({hostname} = urlInfo);
      ({sitekey, allowlisted} = pending);
    }
    else if (parent)
    {
      ({hostname, sitekey, allowlisted} = parent);
    }

    this.hostname = hostname;
    this.sitekey = sitekey;
    this.allowlisted = allowlisted;
    this.pending = null;
  }
}

class PendingFrameInfo
{
  constructor(parent, url, sitekey)
  {
    let allowlisted = 0;
    let hostname;

    if (parent)
    {
      ({allowlisted, hostname} = parent);

      if (!sitekey)
        ({sitekey} = parent);
    }

    while (true)
    {
      let typeMask = ~allowlisted & ALLOWING_TYPES;
      let filter = matcher.match(url, typeMask, hostname, sitekey);

      if (!filter)
        break;

      allowlisted |= filter.contentType & ALLOWING_TYPES;
    }

    this.url = url;
    this.sitekey = sitekey;
    this.allowlisted = allowlisted;
  }
}

async function discoverExistingFrames()
{
  let tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(({id: tabId}) =>
    browser.webNavigation.getAllFrames({tabId}).then(rawFrames =>
    {
      if (!rawFrames || !startupPromise)
        return;

      rawFrames.sort((a, b) => a.frameId - b.frameId);

      let frames = new Map();
      state.set(tabId, frames);

      for (let {frameId, parentFrameId, url} of rawFrames)
        frames.set(frameId, new FrameInfo(frames.get(parentFrameId), url));
    })
  ));
}

function onHeadersReceived(details)
{
  let frames = state.get(details.tabId);
  if (!frames)
  {
    frames = new Map();
    state.set(details.tabId, frames);
  }

  let frame = frames.get(details.frameId);
  let parent = frames.get(details.parentFrameId);
  if (!frame)
  {
    frame = new FrameInfo(parent, "about:blank");
    frames.set(details.frameId, frame);
  }

  let sitekey = getSitekeyFromHeaders(details.responseHeaders, details.url);
  frame.pending = new PendingFrameInfo(parent, details.url, sitekey);
}

function onCommitted({tabId, frameId, parentFrameId, url})
{
  let frames = state.get(tabId);
  let pending;
  let parent;

  if (frames)
  {
    let frame = frames.get(frameId);
    pending = frame && frame.pending;
    parent = frames.get(parentFrameId);
  }

  if (frameId == 0 || !frames)
  {
    frames = new Map();
    state.set(tabId, frames);
  }

  frames.set(frameId, new FrameInfo(parent, url, pending));
}

function onRemoved(tabId)
{
  state.delete(tabId);
}

function onReplaced(addedTabId, removedTabId)
{
  state.delete(removedTabId);
}

function verifyAndExtractSitekey(token, url)
{
  let parts = token.split("_");
  if (parts.length < 2)
    return null;

  let key = parts[0].replace(/=/g, "");
  let signature = parts[1];
  let urlObj = new URL(url);
  let data = `${urlObj.pathname}${urlObj.search}\0${urlObj.host}\0` +
             self.navigator.userAgent;
  if (!verifySignature(key, signature, data))
    return null;

  return key;
}

function getSitekeyFromHeaders(headers, url)
{
  for (let header of headers)
  {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value)
    {
      let sitekey = verifyAndExtractSitekey(header.value, url);
      if (sitekey)
        return sitekey;
    }
  }
  return null;
}

export function getFrameInfo(tabId, frameId)
{
  let frames = state.get(tabId);
  return frames && frames.get(frameId);
}

export async function start()
{
  if (!startupPromise)
  {
    startupPromise = discoverExistingFrames();

    browser.webRequest.onHeadersReceived.addListener(
      onHeadersReceived,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame", "sub_frame"]
      },
      ["responseHeaders"]
    );
    browser.webNavigation.onCommitted.addListener(onCommitted);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.tabs.onReplaced.addListener(onReplaced);
  }

  await startupPromise;
}

export function stop()
{
  startupPromise = null;
  state.clear();

  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onReplaced.removeListener(onReplaced);
}
