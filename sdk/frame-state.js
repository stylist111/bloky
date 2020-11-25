import browser from "webextension-polyfill";
import {parseURL} from "../adblockpluscore/lib/url.js";
import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";
import {verifySignature} from "../adblockpluscore/lib/rsa.js";

export let state = new Map(); // remove export
let startupPromise;

async function discoverExistingFrames()
{
  let tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(({id: tabId}) =>
    browser.webNavigation.getAllFrames({tabId}).then(frames =>
    {
      if (!startupPromise)
        return;

      state.set(tabId, new Map(frames.map(
        ({frameId, parentFrameId, url}) => [frameId, {parentFrameId, url}]
      )));
    })
  ));
}

function onCommitted({tabId, frameId, parentFrameId, url})
{
  let frames = state.get(tabId);
  let frame = frames && frames.get(frameId);
  let sitekey = frame && frame.pendingSitekey || null;
  if (frameId == 0 || !frames)
  {
    frames = new Map();
    state.set(tabId, frames);
  }
  frames.set(frameId, {parentFrameId, url, sitekey});
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

function onHeadersReceived({tabId, frameId, responseHeaders, url})
{
  let pendingSitekey = null;
  for (let header of responseHeaders)
  {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value)
    {
      pendingSitekey = verifyAndExtractSitekey(header.value, url);
      if (pendingSitekey)
        break;
    }
  }

  let frames = state.get(tabId);
  let frame = frames && frames.get(frameId);
  if (frame)
  {
    frame.pendingSitekey = pendingSitekey;
  }
  else if (pendingSitekey)
  {
    if (!frames)
    {
      frames = new Map();
      state.set(tabId, frames);
    }
    frames.set(frameId, {pendingSitekey});
  }
}

export async function startRecordingFrames()
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

export function stopRecordingFrames()
{
  startupPromise = null;
  state.clear();

  browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onReplaced.removeListener(onReplaced);
}

function* getFrameAncestors(tabId, frameId)
{
  let frames = state.get(tabId);
  if (!frames)
    return;

  for (let frame; frame = frames.get(frameId); frameId = frame.parentFrameId)
    yield frame;
}

function findMatchContext(frameAncestors, frameIsParent)
{
  let docDomain = null;
  let sitekey = null;

  for (let frame of frameAncestors)
  {
    if (!docDomain && frameIsParent)
      docDomain = parseURL(frame.url).hostname;
    if (!sitekey)
      sitekey = frame.sitekey;
    frameIsParent = true;
  }

  return {docDomain, sitekey};
}

export function isAllowlisted(tabId, frameId)
{
  let ancestors = Array.from(getFrameAncestors(tabId, frameId));
  for (let i = 0; i < ancestors.length; i++)
  {
    let {docDomain, sitekey} = findMatchContext(ancestors.slice(i), false);
    let filter = defaultMatcher.match(ancestors[i].url, contentTypes.DOCUMENT,
                                      docDomain, sitekey, false);
    if (filter)
      return true;
  }
  return false;
}

export function getMatchContext(tabId, frameId)
{
  return findMatchContext(getFrameAncestors(tabId, frameId), true);
}
