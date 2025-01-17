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
import {default as initializer} from "./initializer.js";
import {logItem} from "./diagnostics.js";
import {getFrameInfo, isTopLevelFrameId, BLANK_PAGE_URL}
  from "./frame-state.js";
import {trace} from "./debugging.js";

const SESSION_STORAGE_KEY = "ewe:popupBlocker:loadingPopups";

class PotentialPopupMap {
  constructor() {
    this.openerPromiseMap = {};
    this.loaded = (async() => {
      let result = await browser.storage.session.get([SESSION_STORAGE_KEY]);
      this.openerMap = result[SESSION_STORAGE_KEY] || {};
    })();
  }

  async saveMap() {
    await browser.storage.session.set({
      [SESSION_STORAGE_KEY]: this.openerMap
    });
  }

  set(tabId, openerPromise) {
    if (this.openerPromiseMap[tabId] ||
        (this.openerMap && this.openerMap[tabId])) {
      return;
    }

    this.openerPromiseMap[tabId] = openerPromise;
    openerPromise.then(async opener => {
      await this.loaded;

      delete this.openerPromiseMap[tabId];
      if (opener) {
        this.openerMap[tabId] = opener;
        await this.saveMap();
      }
    });
  }

  async get(tabId) {
    let openerPromise = this.openerPromiseMap[tabId];
    if (openerPromise) {
      return await openerPromise;
    }

    await this.loaded;
    let opener = this.openerMap[tabId];
    return opener;
  }

  has(tabId) {
    return Object.hasOwnProperty.call(this.openerPromiseMap, tabId) ||
      (this.openerMap && Object.hasOwnProperty.call(this.openerMap, tabId));
  }

  async remove(tabId) {
    if (this.openerPromiseMap[tabId]) {
      delete this.openerPromiseMap[tabId];
    }

    await this.loaded;
    if (this.openerMap[tabId]) {
      delete this.openerMap[tabId];
      await this.saveMap();
    }
  }
}

let potentialPopups;

async function checkPotentialPopup(popupTabId, url, opener) {
  await initializer.start();
  let {docDomain, sitekey, specificOnly} = opener;

  // because of the async nature of getting to this point, it might
  // have been handled before we get here.
  if (!potentialPopups.has(popupTabId)) {
    return;
  }

  let filter = filterEngine.defaultMatcher.match(
    url || BLANK_PAGE_URL, contentTypes.POPUP, docDomain, sitekey, specificOnly
  );

  if (filter) {
    logItem({tabId: opener.tabId, frameId: 0, url}, filter,
            {docDomain, specificOnly, method: "popup"});

    if (filter instanceof BlockingFilter) {
      browser.tabs.remove(popupTabId).catch(() => {});
    }

    await potentialPopups.remove(popupTabId);
  }
}

async function onPopupURLChanged({frameId, tabId, url}) {
  trace({frameId, tabId, url});

  if (!isTopLevelFrameId(frameId)) {
    return;
  }

  let opener = await potentialPopups.get(tabId);
  if (opener) {
    await checkPotentialPopup(tabId, url, opener);
  }
}

async function onCompleted({frameId, tabId, url}) {
  trace({frameId, tabId, url});

  if (!isTopLevelFrameId(frameId) || url == BLANK_PAGE_URL) {
    return;
  }

  let opener = await potentialPopups.get(tabId);
  if (opener) {
    await checkPotentialPopup(tabId, url, opener);
    await potentialPopups.remove(tabId);
  }
}

async function onTabRemoved(tabId) {
  trace({tabId});
  await potentialPopups.remove(tabId);
}

async function onPopup({tabId, url, sourceTabId, sourceFrameId}) {
  trace({tabId, url, sourceTabId, sourceFrameId});

  let openerPromise = (async() => {
    await initializer.start();
    let frame = getFrameInfo(sourceTabId, sourceFrameId) || {};

    if (frame.allowlisted & contentTypes.DOCUMENT) {
      return;
    }

    let opener = {
      tabId: sourceTabId,
      specificOnly: Boolean(frame.allowlisted & contentTypes.GENERICBLOCK),
      docDomain: frame.hostname,
      sitekey: frame.sitekey
    };
    return opener;
  })();

  potentialPopups.set(tabId, openerPromise);

  let opener = await openerPromise;
  if (opener) {
    await checkPotentialPopup(tabId, url, opener);
  }
}

/**
 * Starts blocking popups. Must be called in the first turn of the
 * event loop.
 */
export function start() {
  potentialPopups = new PotentialPopupMap();

  browser.webNavigation.onCreatedNavigationTarget.addListener(onPopup);
  browser.webRequest.onBeforeRequest.addListener(
    onPopupURLChanged,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame"]
    }
  );
  browser.webNavigation.onBeforeNavigate.addListener(onPopupURLChanged);
  browser.webNavigation.onCommitted.addListener(onPopupURLChanged);
  browser.webNavigation.onCompleted.addListener(onCompleted);
  browser.tabs.onRemoved.addListener(onTabRemoved);
}
