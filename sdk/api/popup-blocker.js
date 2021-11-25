/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";

import {defaultMatcher as matcher} from "adblockpluscore/lib/matcher.js";
import {BlockingFilter} from "adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";

import {logItem} from "./diagnostics.js";
import {getFrameInfo} from "./frame-state.js";

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

function checkPotentialPopup(tabId, url, frame)
{
  let specificOnly = (frame.allowlisted & contentTypes.GENERICBLOCK) != 0;
  let filter = matcher.match(
    url || "about:blank", contentTypes.POPUP,
    frame.hostname, frame.sitekey, specificOnly
  );

  if (filter)
  {
    logItem({tabId, frameId: 0, url}, filter,
            {docDomain: frame.hostname, specificOnly, method: "popup"});

    if (filter instanceof BlockingFilter)
      browser.tabs.remove(tabId).catch(() => {});
  }
}

function onPopupURLChanged(details)
{
  if (details.frameId != 0)
    return;

  let frame = loadingPopups.get(details.tabId);
  if (frame)
    checkPotentialPopup(details.tabId, details.url, frame);
}

function onCompleted(details)
{
  if (details.frameId == 0 && details.url != "about:blank")
    forgetPopup(details.tabId);
}

function onPopup({tabId, url, sourceTabId, sourceFrameId})
{
  let frame = getFrameInfo(sourceTabId, sourceFrameId);

  if (frame.allowlisted & contentTypes.DOCUMENT)
    return;

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

  loadingPopups.set(tabId, frame);
  checkPotentialPopup(tabId, url, frame);
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
