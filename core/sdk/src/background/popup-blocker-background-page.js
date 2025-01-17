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

import {BlockingFilter} from "adblockpluscore/lib/filterClasses.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";

import {filterEngine} from "./core.js";
import {logItem} from "./diagnostics.js";
import {getFrameInfo, isTopLevelFrameId, BLANK_PAGE_URL} from "./frame-state.js";
import {trace} from "./debugging.js";

let loadingPopups = new Map();

function forgetPopup(tabId) {
  loadingPopups.delete(tabId);

  if (loadingPopups.size == 0) {
    browser.webRequest.onBeforeRequest.removeListener(onPopupURLChanged);
    browser.webNavigation.onBeforeNavigate.removeListener(onPopupURLChanged);
    browser.webNavigation.onCompleted.removeListener(onCompleted);
    browser.tabs.onRemoved.removeListener(onTabRemoved);
  }
}

function checkPotentialPopup(popupTabId, url, opener) {
  let {docDomain, sitekey, specificOnly} = opener;

  let filter = filterEngine.defaultMatcher.match(
    url || BLANK_PAGE_URL, contentTypes.POPUP,
    docDomain, sitekey, specificOnly
  );

  if (filter) {
    logItem({tabId: opener.tabId, frameId: 0, url}, filter,
            {docDomain, specificOnly, method: "popup"});

    if (filter instanceof BlockingFilter) {
      browser.tabs.remove(popupTabId).catch(() => {});
    }

    forgetPopup(popupTabId);
  }
}

function onPopupURLChanged({frameId, tabId, url}) {
  trace({frameId, tabId, url});

  if (!isTopLevelFrameId(frameId)) {
    return;
  }

  let opener = loadingPopups.get(tabId);
  if (opener) {
    checkPotentialPopup(tabId, url, opener);
  }
}

function onCompleted({frameId, tabId, url}) {
  trace({frameId, tabId, url});

  if (isTopLevelFrameId(frameId) && url != BLANK_PAGE_URL) {
    forgetPopup(tabId);
  }
}

function onTabRemoved(tabId) {
  trace({tabId});
  forgetPopup(tabId);
}

function onPopup({tabId, url, sourceTabId, sourceFrameId}) {
  trace({tabId, url, sourceTabId, sourceFrameId});

  let frame = getFrameInfo(sourceTabId, sourceFrameId) || {};

  if (frame.allowlisted & contentTypes.DOCUMENT) {
    return;
  }

  if (loadingPopups.size == 0) {
    browser.webRequest.onBeforeRequest.addListener(
      onPopupURLChanged,
      {
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame"]
      }
    );
    browser.webNavigation.onBeforeNavigate.addListener(onPopupURLChanged);
    browser.webNavigation.onCompleted.addListener(onCompleted);
    browser.tabs.onRemoved.addListener(onTabRemoved);
  }

  let opener = {
    tabId: sourceTabId,
    specificOnly: Boolean(frame.allowlisted & contentTypes.GENERICBLOCK),
    docDomain: frame.hostname,
    sitekey: frame.sitekey
  };

  loadingPopups.set(tabId, opener);
  checkPotentialPopup(tabId, url, opener);
}

function onTabCreated({id, url, openerTabId}) {
  trace({id, url, openerTabId});

  if (openerTabId) {
    onPopup({tabId: id, url, sourceTabId: openerTabId, sourceFrameId: 0});
  }
}

/**
 * Starts blocking popups. Must only be called after filter engine and
 * frame state are initialized.
 */
export function start() {
  browser.webNavigation.onCreatedNavigationTarget.addListener(onPopup);

  // On Firefox, clicking on a <a target="_blank" rel="noopener"> link doesn't
  // emit the webNavigation.onCreatedNavigationTarget event (and Firefox >=79,
  // implies "noopener" by default). But on Chrome, opening a new empty tab
  // emits the tabs.onCreated event with openerTabId set. So this would
  // cause new tabs created by the user to be considered popups too, on Chrome.
  if (typeof netscape != "undefined") {
    browser.tabs.onCreated.addListener(onTabCreated);
  }
}
