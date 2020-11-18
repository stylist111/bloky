import browser from "webextension-polyfill";
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

function getFrameDetails(tabId, frameId)
{
  let frames = tabs.get(tabId);
  return frames && frames.get(frameId);
}
export function isAllowlisted(tabId, frameId)
{
  let frameDetails = getFrameDetails(tabId, frameId);
  if (!frameDetails)
    return false;

  let parentFrameDetails = getFrameDetails(tabId, frameId);
  let filter = defaultMatcher.match(frameDetails.url, contentTypes.DOCUMENT,
                                    originUrl.hostname, null, false);
}
