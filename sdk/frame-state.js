import browser from "webextension-polyfill";
import {parseURL} from "../adblockpluscore/lib/url.js";
import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

let tabs = new Map();

async function discoverExistingFrames()
{
  for (let tab of await browser.tabs.query({}))
  {
    let tabId = tab.id;
    browser.webNavigation.getAllFrames({tabId}).then(frames =>
    {
      tabs.set(tabId, new Map(frames.map(
        ({frameId, parentFrameId, url}) => [frameId, {parentFrameId, url}]
      )));
    });
  }
}

export function startRecordingFrames()
{
  discoverExistingFrames();

  browser.webNavigation.onCommitted.addListener(({tabId, frameId,
                                                  parentFrameId, url}) =>
  {
    let frames;
    if (frameId == 0 || !(frames = tabs.get(tabId)))
    {
      frames = new Map();
      tabs.set(tabId, frames);
    }
    frames.set(frameId, {parentFrameId, url});
  });

  browser.tabs.onRemoved.addListener(tabId =>
  {
    tabs.delete(tabId);
  });

  browser.tabs.onReplaced.addListener((addedTabId, removedTabId) =>
  {
    tabs.delete(removedTabId);
  });
}

function* getFrameAncestors(tabId, frameId, originUrl)
{
  let frames = tabs.get(tabId);
  if (frames)
  {
    for (let frame; frame = frames.get(frameId); frameId = frame.parentFrameId)
    {
      yield frame;

      if (frameId == 0)
        return;
    }
  }

  if (originUrl)
    yield {parentFrameId: -1, url: originUrl};
}

export function getDocumentDomain(tabId, frameId, originUrl)
{
  for (let {url} of getFrameAncestors(tabId, frameId, originUrl))
  {
    let {hostname} = parseURL(url);
    if (hostname)
      return hostname;
  }
  return "";
}

export function isAllowlisted(tabId, frameId, originUrl)
{
  for (let frame of getFrameAncestors(tabId, frameId, originUrl))
  {
    let docDomain = getDocumentDomain(tabId, frame.parentFrameId, originUrl);
    let filter = defaultMatcher.match(frame.url, contentTypes.DOCUMENT,
                                      docDomain, null, false);
    if (filter)
      return true;
  }
  return false;
}
