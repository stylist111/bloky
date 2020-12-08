import browser from "webextension-polyfill";

import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {BlockingFilter} from "../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

import {getMatchContext, isAllowlisted} from "./frame-state.js";

let loadingPopups = new Map();

function forgetPopup(tabId)
{
  loadingPopups.delete(tabId);

  if (loadingPopups.size == 0)
  {
    browser.webRequest.onBeforeRequest.removeListener(onPopupURLChanged);
    browser.webNavigation.onCommitted.removeListener(onPopupURLChanged);
    browser.webNavigation.onCompleted.removeListener(onCompleted);
    browser.tabs.onRemoved.removeListener(forgetPopup);
  }
}

function checkPotentialPopup(tabId, popup)
{
  let url = popup.url || "about:blank";
  let {docDomain, sitekey} = getMatchContext(tabId, popup.sourceFrameId);

  let specificOnly = isAllowlisted(
    popup.sourceTabId, popup.sourceFrameId,
    contentTypes.GENERICBLOCK
  );

  let filter = defaultMatcher.match(
    url, contentTypes.POPUP,
    docDomain, sitekey, specificOnly
  );

  if (filter instanceof BlockingFilter)
    browser.tabs.remove(tabId).catch(() => {});
}

function onPopupURLChanged(details)
{
  if (details.frameId != 0)
    return;

  let popup = loadingPopups.get(details.tabId);
  if (popup)
  {
    popup.url = details.url;
    if (popup.sourceFrameId != -1)
      checkPotentialPopup(details.tabId, popup);
  }
}

function onCompleted(details)
{
  if (details.frameId == 0 && details.url != "about:blank")
    forgetPopup(details.tabId);
}

function onPopupCreated(tabId, url, sourceTabId, sourceFrameId)
{
  if (loadingPopups.size == 0)
  {
    browser.webRequest.onBeforeRequest.addListener(
      onPopupURLChanged,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame"]
      }
    );
    browser.webNavigation.onCommitted.addListener(onPopupURLChanged);
    browser.webNavigation.onCompleted.addListener(onCompleted);
    browser.tabs.onRemoved.addListener(forgetPopup);
  }

  let popup = {
    url,
    sourceTabId,
    sourceFrameId
  };

  loadingPopups.set(tabId, popup);

  if (isAllowlisted(popup.sourceTabId, sourceFrameId))
  {
    forgetPopup(tabId);
  }
  else
  {
    popup.sourceFrameId = sourceFrameId;
    checkPotentialPopup(tabId, popup);
  }
}

browser.webNavigation.onCreatedNavigationTarget.addListener(details =>
{
  onPopupCreated(details.tabId, details.url, details.sourceTabId,
                 details.sourceFrameId);
});

// On Firefox, clicking on a <a target="_blank" rel="noopener"> link doesn't
// emit the webNavigation.onCreatedNavigationTarget event (and since Firefox 79,
// "noopener" is implied by default). But on Chrome, opening a new empty tab
// emits the tabs.onCreated event with openerTabId set. So the code below would
// cause new tabs created by the user to be considered popups too, on Chrome.
// if (info.platform == "gecko")
// IMPLEMENT LATER: Once info is implemented, look at the below
// if (info.platform == "gecko")
// {
//   browser.tabs.onCreated.addListener(details =>
//   {
//     // We only care about tabs created by another tab.
//     // e.g. clicking on a link with target=_blank.
//     if (typeof details.openerTabId == "undefined")
//       return;

//     // onCreated doesn't provide the frameId of the opener.
//     onPopupCreated(details.id, details.url, details.openerTabId, 0);
//   });
// }
