import browser from "webextension-polyfill";

import {defaultMatcher} from "../../adblockpluscore/lib/matcher.js";
import {BlockingFilter} from "../../adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";

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

function checkPotentialPopup(tabId, url, context)
{
  let filter = defaultMatcher.match(
    url || "about:blank", contentTypes.POPUP,
    context.docDomain, context.sitekey, context.specificOnly
  );

  if (filter instanceof BlockingFilter)
    browser.tabs.remove(tabId).catch(() => {});
}

function onPopupURLChanged(details)
{
  if (details.frameId != 0)
    return;

  let context = loadingPopups.get(details.tabId);
  if (context)
    checkPotentialPopup(details.tabId, details.url, context);
}

function onCompleted(details)
{
  if (details.frameId == 0 && details.url != "about:blank")
    forgetPopup(details.tabId);
}

function onPopup({tabId, url, sourceTabId, sourceFrameId})
{
  if (isAllowlisted(sourceTabId, sourceFrameId))
    return;

  let context = getMatchContext(sourceTabId, sourceFrameId);
  context.specificOnly = isAllowlisted(sourceTabId, sourceFrameId,
                                       contentTypes.GENERICBLOCK);

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

  loadingPopups.set(tabId, context);
  checkPotentialPopup(tabId, url, context);
}

function onTabCreated({id, url, openerTabId})
{
  if (openerTabId)
    onPopup({tabId: id, url, sourceTabId: openerTabId, sourceFrameId: 0});
}

export function start()
{
  browser.webNavigation.onCreatedNavigationTarget.addListener(onPopup);

  // On Firefox, clicking on a <a target="_blank" rel="noopener"> link doesn't
  // emit the webNavigation.onCreatedNavigationTarget event (and Firefox >=79,
  // implies "noopener" by default). But on Chrome, opening a new empty tab
  // emits the tabs.onCreated event with openerTabId set. So this would
  // cause new tabs created by the user to be considered popups too, on Chrome.
  if (typeof netscape != "undefined")
    browser.tabs.onCreated.addListener(onTabCreated);
}

export function stop()
{
  browser.webNavigation.onCreatedNavigationTarget.removeListener(onPopup);
  browser.tabs.onCreated.removeListener(onTabCreated);
}
