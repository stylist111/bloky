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

import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";
import {fuzzSuspendServiceWorker, waitForServiceWorkerInitialization,
        EWE, getTestEvents, clearTestEvents, runInBackgroundPage}
  from "./messaging.js";
import {wait} from "./polling.js";
import {TEST_PAGES_URL, TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";

export const RECENT_FIREFOX_VERSION = 86; // Latest Firefox on February 2021
export const HIDETIMEOUT = isFuzzingServiceWorker() ? 15000 : 1500;
export const UNHIDDENTIMEOUT = isFuzzingServiceWorker() ? 1000 : 200;

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

export async function executeScript(tabId, func, args, world = "ISOLATED") {
  if (browser.scripting &&
      Object.values(browser.scripting.ExecutionWorld).includes(world)) {
    let out =
      await browser.scripting.executeScript(
        {target: {tabId}, func, world, args});
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

export async function expectElemHideHidden({elemId = "elem-hide",
                                            url = "element-hiding.html",
                                            frameIds,
                                            timeout = HIDETIMEOUT} = {}) {
  let tabId = await new Page(url).loaded;
  let getElem = frameIds ?
        () => getVisibleElementInFrame(tabId, elemId, frameIds) :
        () => getVisibleElement(tabId, elemId);

  await wait(
    async() => await getElem() == null,
    timeout,
      `Expected element "${elemId}" on page "${url}" to be hidden, but it was visible.`
  );
}

export async function expectElementToHaveInlineStyle(elemId, expectedStyle) {
  const tabId = await new Page("element-hiding.html").loaded;
  await wait(
    async() => {
      const inlineStyle = await getInlineElementStyle(tabId, elemId);
      return inlineStyle === expectedStyle;
    },
    1500,
    `Inline style for element with ID ${elemId} doesn't match ${expectedStyle}.`
  );
}

export async function expectElemHideRemoved({elemId = "elem-hide",
                                             url = "element-hiding.html",
                                             timeout = HIDETIMEOUT} = {}) {
  const tabId = await new Page(url).loaded;
  await wait(
    async() => await getExistingElement(tabId, elemId) === null,
    timeout,
      `Expected element "${elemId}" on page "${url}" to be removed, but it still exists.`
  );
}

export async function expectElemHideVisible({elemId = "elem-hide",
                                             url = "element-hiding.html",
                                             frameIds,
                                             timeout = UNHIDDENTIMEOUT} = {}) {
  let tabId = await new Page(url).loaded;
  let getElem = frameIds ?
        () => getVisibleElementInFrame(tabId, elemId, frameIds) :
        () => getVisibleElement(tabId, elemId);
  // If we're expecting things to not be hidden, but we check before
  // the filters have a chance to be applied, then we're not really
  // testing anything.
  await new Promise(r => setTimeout(r, timeout));

  let elem = await getElem();
  expect(elem).not.toBeNull();
}
export class Page {
  constructor(path, forceBackground = false, removeCurrent = true) {
    let removingCurrentPromise = removeCurrent ?
      Page.removeCurrent() : Promise.resolve();

    if (!Page.current) {
      Page.current = new Set();
    }
    const newPage = this;

    this.url = this.getUrl(path);
    this.created = (async() => {
      await removingCurrentPromise;
      Page.current.add(newPage);

      // Firefox appears to have an issue where if a tab is opened in
      // the background (not active), the browser forgets that blocked
      // requests on that page were blocked and tries to request them
      // again. Functionally everything still works fine, but the
      // duplicate requests do mess with our tests.
      let active = isFirefox() && !forceBackground;

      await fuzzSuspendServiceWorker();
      return (await browser.tabs.create({url: this.url, active})).id;
    })();

    this.loaded = this.waitForPageLoadAfterPromise(this.created);
  }

  getUrl(path) {
    return path.includes(":") ? path : `${TEST_PAGES_URL}/${path}`;
  }

  waitForPageLoadAfterPromise(promise) {
    return promise.then(tabId => {
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
    await fuzzSuspendServiceWorker();
    await browser.tabs.reload(tabId, {bypassCache});
    return tabId;
  }

  async load(path) {
    this.url = this.getUrl(path);
    let tabId = await this.created;
    let promise = browser.tabs.update(tabId, {url: this.url});
    await this.waitForPageLoadAfterPromise(promise.then(() => tabId));
  }

  async stillExists() {
    let tabId = await this.created;
    try {
      await browser.tabs.get(tabId);
      return true;
    }
    catch (e) {
      return false;
    }
  }

  expectResource(path) {
    let resource = new Resource(path, this);

    return {
      toBeBlocked() {
        return resource.expectToBeBlocked();
      },
      toBeAborted() {
        return resource.expectToBeAborted();
      },
      toBeLoaded() {
        return resource.expectToBeLoaded();
      }
    };
  }

  async remove() {
    Page.current.delete(this);

    let tabId = await this.created;
    try {
      await browser.tabs.remove(tabId);
    }
    catch (err) {
      if (err.message == "Cannot remove NTP tab.") {
        // https://answers.microsoft.com/en-us/microsoftedge/forum/all/latest-edge-version-1130177442-official-build-64/ca2ec400-c643-4e7a-a0b0-f158cc84af50
        console.warn(err.message);
      }
      else {
        throw err;
      }
    }
  }

  static async removeCurrent() {
    if (Page.current) {
      for (const page of Page.current) {
        await page.remove();
      }
    }
  }
}

export class Resource {
  constructor(path, page) {
    this.path = path;

    this.error = new Promise((resolve, reject) => {
      let tabIdPromise = page ? page.created : Promise.resolve(null);
      let url = new URL(path, TEST_PAGES_URL).href;

      function matches(details, tabId) {
        let requestUrl = new URL(details.url);
        return (details.tabId == tabId || !tabId) &&
          requestUrl.origin + requestUrl.pathname == url;
      }

      function removeListeners() {
        browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
        browser.webRequest.onCompleted.removeListener(onCompleted);
      }

      async function onErrorOccurred(details) {
        let tabId = await tabIdPromise;
        handleConnection(details, tabId, removeListeners, reject);
        if (matches(details, tabId)) {
          removeListeners();
          resolve(details);
        }
      }

      async function onCompleted(details) {
        let tabId = await tabIdPromise;
        if (matches(details, tabId)) {
          removeListeners();
          resolve();
        }
      }

      let filter = {urls: ["<all_urls>"]};
      browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);
      browser.webRequest.onCompleted.addListener(onCompleted, filter);
    });

    this.completed = this.error.then(e => null);
  }

  async expectToBeBlocked() {
    let error = await this.error;
    let blocked = error &&
        /^(net::ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT)$/.test(error.error);

    if (!blocked) {
      throw new Error(`${this.path} was not blocked`);
    }
  }

  // The "aborted" error is emitted for subresources loaded from
  // a web bundle that wasn't loaded (blocked)
  // This is currently only in Chrome.
  // What is the Firefox equivalent? It doesn't support web bundle.
  async expectToBeAborted() {
    let error = await this.error;
    let aborted = error &&
        /^(net::ERR_ABORTED)$/.test(error.error);

    if (!aborted) {
      throw new Error(`${this.path} was not aborted`);
    }
  }

  async expectToBeLoaded() {
    let error = await this.error;
    let loaded = typeof error == "undefined";

    if (!loaded) {
      throw new Error(`${this.path} did not load successfully`);
    }
  }
}

export class Popup {
  constructor(id, opener, deferred = false) {
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

        fuzzSuspendServiceWorker()
          .then(() => clickElement(openerTabId, id))
          .catch(err => {
            removeListeners();
            reject(err);
          });
      }, reject);
    });

    this.blocked = new Promise((resolve, reject) => {
      this.created.then(async popupTabId => {
        if (isFuzzingServiceWorker()) {
          await waitForServiceWorkerInitialization();
        }

        return popupTabId;
      }).then(popupTabId => {
        let blockedResolved = false;
        function removeListeners() {
          browser.tabs.onRemoved.removeListener(onTabRemoved);
          browser.webNavigation.onCompleted.removeListener(onCompleted);
        }

        function onTabRemoved(tabId) {
          if (tabId == popupTabId) {
            if (!blockedResolved) {
              blockedResolved = true;
              removeListeners();
              Popup.current = null;
              resolve(true);
            }
          }
        }

        function onCompletedAfterWait() {
          if (!blockedResolved) {
            blockedResolved = true;
            removeListeners();
            resolve(false);
          }
        }

        function onCompleted(details) {
          if (details.tabId == popupTabId &&
              details.frameId == 0 &&
              details.url != "about:blank") {
            let tolerance = 200;

            if (deferred) {
              tolerance += 200;
            }

            if (isFuzzingServiceWorker()) {
              tolerance += 1000;
            }

            setTimeout(onCompletedAfterWait, tolerance);
          }
        }

        browser.tabs.onRemoved.addListener(onTabRemoved);
        browser.webNavigation.onCompleted.addListener(onCompleted);

        // As with normal pages, it's possible that the we missed the
        // events above. Especially since this is called
        // asynchronously after the tab is created.
        browser.tabs.get(popupTabId).then(tab => {
          if (tab.url && tab.url != "about:blank" && tab.status == "complete") {
            onCompleted({tabId: popupTabId, frameId: 0, url: tab.url});
          }
        }).catch(() => {
          // We are assuming that this error is because the tab
          // doesn't exist, and not some other error. This means it's
          // already been blocked.
          onTabRemoved(popupTabId);
        });
      }, reject);
    });

    if (!Popup.current) {
      Popup.current = [];
    }

    Popup.current.push(this);
  }

  static async removeCurrent() {
    if (!Popup.current) {
      return;
    }

    for (let removingPopup of Popup.current) {
      let tabId = await removingPopup.created;
      // popup may already be closed if it was blocked, so this may fail
      await browser.tabs.remove(tabId).catch(() => {});
    }
    Popup.current = null;
  }
}

export function setMinTimeout(runnable, timeout) {
  let currentTimeout = runnable.timeout();
  if (currentTimeout < timeout && currentTimeout != 0) {
    runnable.timeout(timeout);
  }
}

export function increaseMinTimeout(runnable, extra) {
  let currentTimeout = runnable.timeout();
  if (currentTimeout != 0) {
    runnable.timeout(currentTimeout + extra);
  }
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

export function waitForAssertion(condition, timeout = 1000, pollTimeout = 100) {
  if (typeof condition !== "function") {
    throw TypeError("Wait condition must be a function");
  }

  async function evaluateCondition() {
    try {
      await condition(this);
      return {assertionPassed: true};
    }
    catch (error) {
      return {assertionPassed: false, error};
    }
  }

  let result = new Promise((resolve, reject) => {
    let startTime = performance.now();
    let pollCondition = async() => {
      let {assertionPassed, error} = await evaluateCondition();
      let elapsed = performance.now() - startTime;

      if (assertionPassed) {
        resolve();
      }
      else if (timeout && elapsed >= timeout) {
        error.message =
          `${error.message}\nWait for assertion timed out after ${elapsed}ms`;
        reject(error);
      }
      else {
        setTimeout(pollCondition, pollTimeout);
      }
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

function getBrowserVersion(pattern) {
  return new RegExp(pattern)
    .exec(navigator.userAgent)
    .splice(1)
    .map(str => parseInt(str, 10));
}

export function edgeVersion() {
  return getBrowserVersion("Edg.?\\/(\\d*).(\\d*).(\\d*).(\\d*)");
}

export function isChromiumBased() {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
}

export function chromiumVersion() {
  return getBrowserVersion("Chrom.+\\/(\\d*).(\\d*).(\\d*).(\\d*)\\s.+");
}

export function getMaxDynamicRulesAvailable() {
  const dnr = browser.declarativeNetRequest;

  // Chromium/Edge
  if (isChromiumBased()) {
    // The allowed number of dynamic rules depends on
    // the Chromium version, see EE-315.
    const browserVersion = isEdge() ? edgeVersion() : chromiumVersion();
    return browserVersion[0] < 121 ?
      dnr.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES :
      dnr.MAX_NUMBER_OF_DYNAMIC_RULES;
  }

  // Firefox
  return dnr.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
}

// Feature detection for web bundle support.
export function supportsWebBundle() {
  // HTMLScriptElement.supports is only Chrome 96+ or Firefox 94+
  return HTMLScriptElement.supports && HTMLScriptElement.supports("webbundle");
}

export function getVisibleElement(tabId, elemId) {
  return executeScript(tabId, id => {
    let el = document.getElementById(id);
    return el.offsetParent ? el.outerHTML : null;
  }, [elemId]);
}

export function getExistingElement(tabId, elemId) {
  return executeScript(tabId, id => {
    let el = document.getElementById(id);
    return el ? el.outerHTML : null;
  }, [elemId]);
}

export function getInlineElementStyle(tabId, elemId) {
  return executeScript(tabId, id => {
    const el = document.getElementById(id);
    const inlineStyles = el.style.cssText;
    return inlineStyles;
  }, [elemId]);
}

export function getVisibleElementInFrame(tabId, elemId, frameElementIds) {
  return executeScript(tabId, (frameIds, elementId) => {
    let frameDocument = document;
    for (let frameId of frameIds) {
      frameDocument = frameDocument.getElementById(frameId).contentDocument;
    }
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

export async function writeFile(prefix, fileName, data) {
  return browser.storage.local.set({
    [prefix + fileName]: {
      content: Array.from(data),
      lastModified: Date.now()
    }
  });
}

export async function readFile(prefix, fileName) {
  let key = prefix + fileName;
  let items = await browser.storage.local.get(key);
  let entry = items[key];
  if (entry) {
    return entry;
  }
}

export async function waitForHighlightedStyle(timeout = 5000) {
  let tabId = await new Page("element-hiding.html").loaded;
  let style;
  await wait(async() => {
    style = await executeScript(tabId, () => {
      let elem = document.getElementById("elem-hide");
      return window.getComputedStyle(elem)["background-color"];
    });
    return style != "rgba(0, 0, 0, 0)";
  }, timeout, "Style is not highlighted");

  return style;
}

export async function shouldBeLoaded(pageUrl, resource, errorMessage) {
  await wait(
    async() => {
      try {
        await new Page(pageUrl).expectResource(resource).toBeLoaded();
        return true;
      }
      catch (e) {}
      return false;
    }, 4000, errorMessage ? errorMessage : `${resource} on ${pageUrl} was not loaded`
  );
}

async function throwHttpErrors(response) {
  if (!response.ok) {
    let body = await response.text();
    throw new Error(
      "Admin server error. Server responded with the following: " +
        `${response.status} - ${body}`
    );
  }
}

export async function clearRequestLogs() {
  let response = await fetch(`${TEST_ADMIN_PAGES_URL}/clearRequestLogs`, {
    method: "POST"
  });
  await throwHttpErrors(response);
}

function stripAdminUrl(url) {
  if (url.startsWith(TEST_ADMIN_PAGES_URL)) {
    return url.slice(TEST_ADMIN_PAGES_URL.length);
  }
  return url;
}

export async function fetchFilterText(url) {
  let response = await fetch(url);
  await throwHttpErrors(response);

  let requestText = await response.text();
  let lines = requestText.split(/[\r?\n]+/);

  let filters = lines
    .map(filter => filter.trim())
      .filter((line, index) =>
        index > 0 && // first line is a header
          line.length > 0 && // skip empty lines
          line[0] != "!" // skip comments
      );

  return filters;
}

/**
 * Gets the list of requests that happened on the test server.
 *
 * @param {String?} url Only get requests for this URL. This should not include
 * any query parameters. This can be both a relative path like `/telemetry`, or
 * a full url like `http://localhost:3003/telemetry`.
 */
export async function getRequestLogs(url) {
  let response = await fetch(`${TEST_ADMIN_PAGES_URL}/requestLogs`);
  await throwHttpErrors(response);
  let requestLogs = await response.json();

  if (url) {
    let path = stripAdminUrl(url);
    requestLogs = requestLogs.filter(log => log.path == path);
  }

  return requestLogs;
}

export async function setEndpointResponse(url, response, method, status,
                                          headers) {
  let adminApiResponse = await fetch(`${TEST_ADMIN_PAGES_URL}/setUrlResponse`, {
    method: "POST",
    cache: "no-cache",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      url: stripAdminUrl(url),
      response,
      method,
      status,
      headers
    })
  });
  await throwHttpErrors(adminApiResponse);
}

export async function clearEndpointResponse(url) {
  let response = await fetch(`${TEST_ADMIN_PAGES_URL}/clearUrlResponse`, {
    method: "POST",
    cache: "no-cache",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({url: stripAdminUrl(url)})
  });
  await throwHttpErrors(response);
}

export async function waitForSubscriptionsToDownload() {
  await wait(async() => {
    // don't use the proxy because it will suspend the service worker, which
    // will interrupt any download we're currently waiting for.
    let subscriptions = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "subscriptions"},
      {op: "callMethod", arg: "getSubscriptions"},
      {op: "await"}
    ], false);

    return subscriptions.every(
      sub => sub.diffURL || sub.downloadStatus == "synchronize_ok"
    );
  }, 1000, "Subscriptions were not downloaded.");
}

export async function waitForSubscriptionToBeSynchronized(
  url, clear = true, timeout = 3000) {
  await wait(() => {
    let changeEvents = getTestEvents("subscriptions.onChanged");
    return changeEvents.filter(event => {
      return event[0].url == url &&
        event[1] == null; // whole subscription update, not property
    }).length > 0;
  }, timeout, "Subscription was not synchronized.");

  if (clear) {
    clearTestEvents("subscriptions.onChanged");
  }
}

/**
 * Waits until we've received all of the events for a subscription trying to
 * sync, downloading successfully, and then having an error when processing the
 * update.
 * @param {string} subscriptionUrl
 * @param {string} expectedError
 */
export async function waitForSubscriptionToFailToUpdate(
  subscriptionUrl, expectedError = "synchronize_too_many_filters") {
  await waitForAssertion(async() => {
    let changeEvents = getTestEvents("subscriptions.onChanged");
    expect(changeEvents).toContainEqual([
      expect.objectContaining({
        url: subscriptionUrl,
        downloadStatus: "synchronize_ok"
      }),
      "downloadStatus"
    ]);
  }, 2000);

  await waitForAssertion(async() => {
    let changeEvents = getTestEvents("subscriptions.onChanged");
    expect(changeEvents).toContainEqual([
      expect.objectContaining({
        url: subscriptionUrl,
        downloadStatus: expectedError
      }),
      "downloadStatus"
    ]);
  });
}

export async function waitForSubscriptionToBeRemoved(url) {
  await wait(() => {
    let changeEvents = getTestEvents("subscriptions.onRemoved");
    return changeEvents.filter(event => {
      return event[0].url == url &&
        event[1] == null;
    }).length > 0;
  }, 3000, "Subscription was not removed.");

  clearTestEvents("subscriptions.onRemoved");
}

async function syncSubscription(
  subscriptionUrl, lastFilterChecker, errorMessageDetails) {
  await EWE.subscriptions.sync(subscriptionUrl);
  await wait(async() => {
    let filters = await EWE.subscriptions.getFilters(subscriptionUrl);
    const lastFilter = filters.slice(-1)[0];

    if (lastFilter && lastFilterChecker(lastFilter.text)) {
      return true;
    }
  }, 10000, `Subscription was not synchronised properly (${errorMessageDetails}).`);
  await EWE.debugging.ensureEverythingHasSaved();
}

export async function syncSubHasLastFilter(url, filter) {
  await syncSubscription(url, lastFilter => lastFilter === filter, "filter added");
}

export async function syncSubHasNoLastFilter(url, filter) {
  await syncSubscription(url, lastFilter => lastFilter !== filter, "filter removed");
}

/**
 * Waits for a given number of milliseconds.
 *
 * @param {number} ms - The number of milliseconds to sleep for.
 * @returns {Promise<unknown>}
 */
export async function sleep(ms) {
  const start = performance.now();
  // Use polling instead of setTimeout since we had inconsistent results
  // on devices with high CPU usage
  return wait(() => performance.now() - start >= ms);
}
