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

function* getFrameAncestors(tabId, frameId)
{
  let frames = tabs.get(tabId);
  if (!frames)
    return;

  for (let frame; frame = frames.get(frameId); frameId = frame.parentFrameId)
    yield frame;
}

export function getDocumentDomain(tabId, frameId)
{
  for (let {url} of getFrameAncestors(tabId, frameId))
  {
    let {hostname} = parseURL(url);
    if (hostname)
      return hostname;
  }
  return "";
}

export function isAllowlisted(tabId, frameId)
{
  for (let frame of getFrameAncestors(tabId, frameId))
  {
    let docDomain = getDocumentDomain(tabId, frame.parentFrameId);
    let filter = defaultMatcher.match(frame.url, contentTypes.DOCUMENT,
                                      docDomain, null, false);
    if (filter)
      return true;
  }
  return false;
}
