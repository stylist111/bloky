import browser from "webextension-polyfill";
import {parseURL} from "../adblockpluscore/lib/url.js";
import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

let state = new Map();
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
  let frames;
  if (frameId == 0 || !(frames = state.get(tabId)))
  {
    frames = new Map();
    state.set(tabId, frames);
  }
  frames.set(frameId, {parentFrameId, url});
}

function onRemoved(tabId)
{
  state.delete(tabId);
}

function onReplaced(addedTabId, removedTabId)
{
  state.delete(removedTabId);
}

export async function startRecordingFrames()
{
  if (!startupPromise)
  {
    startupPromise = discoverExistingFrames();

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

  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onReplaced.removeListener(onReplaced);
}

function* getFrameAncestors(tabId, frameId, originUrl)
{
  let frames = state.get(tabId);
  if (frames)
  {
    for (let frame; frame = frames.get(frameId); frameId = frame.parentFrameId)
    {
      yield frame.url;

      if (frameId == 0)
        return;
    }
  }

  if (originUrl)
    yield originUrl;
}

function getClosestDocumentDomain(urls)
{
  for (let url of urls)
  {
    let {hostname} = parseURL(url);
    if (hostname)
      return hostname;
  }
  return "";
}

export function isAllowlisted(tabId, frameId, originUrl)
{
  let ancestors = Array.from(getFrameAncestors(tabId, frameId, originUrl));
  for (let i = 0; i < ancestors.length; i++)
  {
    let docDomain = getClosestDocumentDomain(ancestors.slice(i + 1));
    let filter = defaultMatcher.match(ancestors[i], contentTypes.DOCUMENT,
                                      docDomain, null, false);
    if (filter)
      return true;
  }
  return false;
}

export function getDocumentDomain(tabId, frameId, originUrl)
{
  return getClosestDocumentDomain(getFrameAncestors(tabId, frameId, originUrl));
}
