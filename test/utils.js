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
import expect from "expect";

export const TEST_PAGES_DOMAIN = "localhost";
export const CROSS_DOMAIN = "127.0.0.1";
export const TEST_PAGES_URL = `http://${TEST_PAGES_DOMAIN}:3000`;
export const CROSS_DOMAIN_URL = `http://${CROSS_DOMAIN}:3000`;
// the page will be served with this sitekey if you pass in sitekey=1
// as a query param. Eg http://localhost:3000/image.html?sitekey=1
export const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                       "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                       "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";
export const RECENT_FIREFOX_VERSION = 86; // Latest Firefox on February 2021

function handleConnection(details, tabId, removeListeners, reject) {
  if ((details.tabId == tabId || !tabId) &&
      (details.error == "net::ERR_CONNECTION_REFUSED" ||
       details.error == "NS_ERROR_CONNECTION_REFUSED" ||
       // Under some circumstances (e.g. when loading the page in the CSP tests)
       // Firefox fails to load the page with the plain error code.
       details.error == "Error code 2152398861")) {
    removeListeners();
    reject(new Error("Connection refused. Test pages server is probably down"));
  }
}

export async function executeScript(tabId, func, args) {
  if (browser.scripting) {
    let out =
      await browser.scripting.executeScript({target: {tabId}, func, args});
    return out[0].result;
  }

  let argsString = args ? args.map(JSON.stringify).join(",") : "";
  return (await browser.tabs.executeScript(
    tabId, {code: `(${func})(${argsString});`})
  )[0];
}

export async function clickElement(tabId, elementId) {
  await executeScript(
    tabId,
    elemId => document.getElementById(elemId).click(),
    [elementId]
  );
}

export class Page {
  constructor(path, fullUrl = false, forceBackground = false) {
    let removingCurrentPromise = Page.removeCurrent();
    Page.current = this;

    this.url = fullUrl ? path : `${TEST_PAGES_URL}/${path}`;
    this.created = (async() => {
      await removingCurrentPromise;

      // Firefox appears to have an issue where if a tab is opened in
      // the background (not active), the browser forgets that blocked
      // requests on that page were blocked and tries to request them
      // again. Functionally everything still works fine, but the
      // duplicate requests do mess with our tests.
      let active = isFirefox() && !forceBackground;

      return (await browser.tabs.create({url: this.url, active})).id;
    })();

    this.loaded = this.created.then(tabId => {
      return new Promise((resolve, reject) => {
        function removeListeners() {
          browser.webNavigation.onCompleted.removeListener(onCompleted);
          browser.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
        }

        function onCompleted(details) {
          if (details.tabId == tabId && details.frameId == 0) {
            removeListeners();
            resolve(tabId);
          }
        }

        function onErrorOccurred(details) {
          handleConnection(details, tabId, removeListeners, reject);
        }

        browser.webNavigation.onCompleted.addListener(onCompleted);
        browser.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

        // If the tab is already complete, then the above event won't
        // ever fire. In practice, this only happens if the tab being
        // loaded is empty.
        browser.tabs.get(tabId).then(tab => {
          // URL comparison is needed because it seems old versions of
          // Firefox say they're completed before actually starting
          // navigation.
          if (tab.url == this.url && tab.status == "complete") {
            removeListeners();
            resolve(tabId);
          }
        });
      });
    });
  }

  async reload(bypassCache = false) {
    let tabId = await this.created;
    await browser.tabs.reload(tabId, {bypassCache});
    return tabId;
  }

  expectResource(path) {
    let resource = new Resource(path, this);

    return {
      toBeBlocked() {
        return resource.expectToBeBlocked();
      },
      toBeLoaded() {
        return resource.expectToBeLoaded();
      }
    };
  }

  static async removeCurrent() {
    let removingPage = Page.current;
    Page.current = null;
    if (removingPage) {
      let tabId = await removingPage.created;
      await browser.tabs.remove(tabId);
    }
  }
}

export class Resource {
  constructor(path, page) {
    this.error = (async() => {
      let tabId = page && await page.created;
      let url = new URL(path, TEST_PAGES_URL).href;
      let onErrorOccurred;
      let onCompleted;

      function matches(details) {
        let requestUrl = new URL(details.url);
        return requestUrl.origin + requestUrl.pathname == url;
      }

      function removeListeners() {
        browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
        browser.webRequest.onCompleted.removeListener(onCompleted);
      }

      let error = await new Promise((resolve, reject) => {
        let filter = {urls: ["<all_urls>"], tabId};

        onErrorOccurred = details => {
          handleConnection(details, tabId, removeListeners, reject);
          return matches(details) && resolve(details);
        };
        onCompleted = details => matches(details) && resolve();

        browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);
        browser.webRequest.onCompleted.addListener(onCompleted, filter);
      });

      removeListeners();
      return error;
    })();

    this.completed = this.error.then(e => null);
  }

  async expectToBeBlocked() {
    expect(await this.error).toEqual(expect.objectContaining({
      error: expect.stringMatching(/^(net::ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT)$/)
    }));
  }

  async expectToBeLoaded() {
    expect(await this.error).toBeUndefined();
  }
}

export class Popup {
  constructor(id, opener, deferred = false) {
    this.deferred = deferred;

    this.created = new Promise((resolve, reject) => {
      opener.loaded.then(openerTabId => {
        let {onCreatedNavigationTarget} = browser.webNavigation;

        function removeListeners() {
          browser.tabs.onCreated.removeListener(onTabCreated);
          onCreatedNavigationTarget.removeListener(onNavigationTarget);
          browser.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
        }

        function onTabCreated(tab) {
          if (tab.openerTabId == openerTabId) {
            removeListeners();
            resolve(tab.id);
          }
        }

        function onNavigationTarget(details) {
          if (details.sourceTabId == openerTabId) {
            removeListeners();
            resolve(details.tabId);
          }
        }

        function onErrorOccurred(details) {
          handleConnection(details, openerTabId, removeListeners, reject);
        }

        browser.tabs.onCreated.addListener(onTabCreated);
        onCreatedNavigationTarget.addListener(onNavigationTarget);
        browser.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

        clickElement(openerTabId, id).catch(err => {
          removeListeners();
          reject(err);
        });
      }, reject);
    });

    this.blocked = new Promise((resolve, reject) => {
      this.created.then(popId => new Promise(res => {
        if (this.deferred)
          setTimeout(() => res(popId), 200);
        else
          res(popId);
      })).then(popupTabId => {
        function removeListeners() {
          browser.tabs.onRemoved.removeListener(onTabRemoved);
          browser.webNavigation.onCompleted.removeListener(onCompleted);
        }

        function onTabRemoved(tabId) {
          if (tabId == popupTabId) {
            removeListeners();
            Popup.current = null;
            resolve(true);
          }
        }

        function onCompleted(details) {
          if (details.tabId == popupTabId &&
              details.frameId == 0 &&
              details.url != "about:blank") {
            removeListeners();
            resolve(false);
          }
        }

        browser.tabs.onRemoved.addListener(onTabRemoved);
        browser.webNavigation.onCompleted.addListener(onCompleted);

        // As with normal pages, it's possible that the we missed the
        // events above. Especially since this is called
        // asynchronously after the tab is created.
        browser.tabs.get(popupTabId).then(tab => {
          if (tab.url && tab.url != "about:blank" && tab.status == "complete") {
            removeListeners();
            resolve(false);
          }
        }).catch(() => {
          // We are assuming that this error is because the tab
          // doesn't exist, and not some other error. This means it's
          // already been blocked.
          removeListeners();
          resolve(true);
        });
      }, reject);
    });

    Popup.current = this;
  }

  static async removeCurrent() {
    let removingPopup = Popup.current;
    Popup.current = null;
    if (removingPopup) {
      let tabId = await removingPopup.created;
      // popup may already be closed if it was blocked, so this may fail
      await browser.tabs.remove(tabId).catch(() => {});
    }
  }
}

export function setMinTimeout(runnable, timeout) {
  let currentTimeout = runnable.timeout();
  if (currentTimeout < timeout && currentTimeout != 0)
    runnable.timeout(timeout);
}

export async function waitForInvisibleElement(tabId, id) {
  await wait(async() => {
    let result = await executeScript(tabId, elemId => {
      let el = document.getElementById(elemId);
      return el.offsetParent ? el.outerHTML : null;
    }, [id]);
    return result == null;
  }, 1000, `The element with id "${id}" is still visible`);
}

export function wait(condition, timeout = 0, message, pollTimeout = 100) {
  if (typeof condition !== "function")
    throw TypeError("Wait condition must be a function");

  function evaluateCondition() {
    return new Promise((resolve, reject) => {
      try {
        resolve(condition(this));
      }
      catch (ex) {
        reject(ex);
      }
    });
  }

  let result = new Promise((resolve, reject) => {
    let startTime = Date.now();
    let pollCondition = async() => {
      evaluateCondition().then(value => {
        let elapsed = Date.now() - startTime;
        if (value) {
          resolve(value);
        }
        else if (timeout && elapsed >= timeout) {
          try {
            let timeoutMessage = message ?
              `${typeof message === "function" ? message() : message}\n` : "";
            reject(
              new Error(`${timeoutMessage}Wait timed out after ${elapsed}ms`)
            );
          }
          catch (ex) {
            reject(
              new Error(`${ex.message}\nWait timed out after ${elapsed}ms`)
            );
          }
        }
        else {
          setTimeout(pollCondition, pollTimeout);
        }
      }, reject);
    };
    pollCondition();
  });

  return result;
}

export function isFirefox() {
  return typeof netscape != "undefined";
}

export function firefoxVersion() {
  let version = /Firefox\/(\d+)/.exec(navigator.userAgent)[1];
  return parseInt(version, 10);
}

export function isEdge() {
  return navigator.appVersion.indexOf("Edg") > -1;
}

export function getVisibleElement(tabId, elemId) {
  return executeScript(tabId, id => {
    let el = document.getElementById(id);
    return el.offsetParent ? el.outerHTML : null;
  }, [elemId]);
}

export function getVisibleElementInFrame(tabId, elemId, frameElementIds) {
  return executeScript(tabId, (frameIds, elementId) => {
    let frameDocument = document;
    for (let frameId of frameIds)
      frameDocument = frameDocument.getElementById(frameId).contentDocument;
    let el = frameDocument.getElementById(elementId);
    return el.offsetParent ? el.outerHTML : null;
  }, [frameElementIds, elemId]);
}

export function isMV3() {
  return typeof browser.declarativeNetRequest != "undefined";
}

export function isIncognito() {
  let incognito = new URLSearchParams(document.location.search).get("incognito");
  return incognito == "true";
}

export function isCustomSubsExtension() {
  let manifest = browser.runtime.getManifest();
  return manifest.description.endsWith("custom subscriptions");
}
