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

export const TEST_PAGES_DOMAIN = "localhost";
export const TEST_PAGES_URL = `http://${TEST_PAGES_DOMAIN}:3000`;
export const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                       "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                       "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";
export const RECENT_FIREFOX_VERSION = 86; // Latest Firefox on February 2021

function handleConnection(details, tabId, removeListeners, reject)
{
  if ((details.tabId == tabId || !tabId) &&
      (details.error == "net::ERR_CONNECTION_REFUSED" ||
       details.error == "NS_ERROR_CONNECTION_REFUSED" ||
       // Under some circumstances (e.g. when loading the page in the CSP tests)
       // Firefox fails to load the page with the plain error code.
       details.error == "Error code 2152398861"))
  {
    removeListeners();
    reject(new Error("Connection refused. Test pages server is probably down"));
  }
}

export class Page
{
  constructor(path)
  {
    this.url = `${TEST_PAGES_URL}/${path}`;
    this.created = (async() =>
    {
      if (Page.current)
        await browser.tabs.remove(await Page.current.created);

      return (await browser.tabs.create({url: this.url, active: false})).id;
    })();

    Page.current = this;
  }

  async loaded()
  {
    let tabId = await this.created;

    return new Promise((resolve, reject) =>
    {
      function removeListeners()
      {
        browser.webNavigation.onCompleted.removeListener(onCompleted);
        browser.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
      }

      function onCompleted(details)
      {
        if (details.tabId == tabId && details.frameId == 0)
        {
          removeListeners();
          resolve(tabId);
        }
      }

      function onErrorOccurred(details)
      {
        handleConnection(details, tabId, removeListeners, reject);
      }

      browser.webNavigation.onCompleted.addListener(onCompleted);
      browser.webNavigation.onErrorOccurred.addListener(onErrorOccurred);
    });
  }

  expectResource(path)
  {
    let resource = new Resource(path, this);

    return {
      toBeBlocked()
      {
        return resource.expectToBeBlocked();
      },
      toBeLoaded()
      {
        return resource.expectToBeLoaded();
      }
    };
  }

  static removeCurrent()
  {
    if (Page.current)
    {
      Page.current.created.then(browser.tabs.remove);
      Page.current = null;
    }
  }
}

export class Resource
{
  constructor(path, page)
  {
    this.error = (async() =>
    {
      let tabId = page && await page.created;
      let url = new URL(path, TEST_PAGES_URL).href;
      let onErrorOccurred;
      let onCompleted;

      function matches(details)
      {
        let requestUrl = new URL(details.url);
        return requestUrl.origin + requestUrl.pathname == url;
      }

      function removeListeners()
      {
        browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
        browser.webRequest.onCompleted.removeListener(onCompleted);
      }

      let error = await new Promise((resolve, reject) =>
      {
        let filter = {urls: ["<all_urls>"], tabId};

        onErrorOccurred = details =>
        {
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
  }

  async expectToBeBlocked()
  {
    expect(await this.error).toEqual(expect.objectContaining({
      error: expect.stringMatching(/^(net::ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT)$/)
    }));
  }

  async expectToBeLoaded()
  {
    expect(await this.error).toBeUndefined();
  }
}

export class Popup
{
  constructor(id, opener)
  {
    this.created = new Promise((resolve, reject) =>
    {
      opener.created.then(openerTabId =>
      {
        let {onCreatedNavigationTarget} = browser.webNavigation;

        function removeListeners()
        {
          browser.tabs.onCreated.removeListener(onTabCreated);
          onCreatedNavigationTarget.removeListener(onNavigationTarget);
          browser.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
        }

        function onTabCreated(tab)
        {
          removeListeners();
          resolve(tab.id);
        }

        function onNavigationTarget(details)
        {
          removeListeners();
          resolve(details.tabId);
        }

        function onErrorOccurred(details)
        {
          handleConnection(details, openerTabId, removeListeners, reject);
        }

        let code = `document.getElementById("${id}").click()`;
        browser.tabs.executeScript(openerTabId, {code}).catch(err =>
        {
          removeListeners();
          reject(err);
        });

        browser.tabs.onCreated.addListener(onTabCreated);
        onCreatedNavigationTarget.addListener(onNavigationTarget);
        browser.webNavigation.onErrorOccurred.addListener(onErrorOccurred);
      }, reject);
    });

    this.blocked = new Promise((resolve, reject) =>
    {
      this.created.then(popupTabId =>
      {
        function removeListeners()
        {
          browser.tabs.onRemoved.removeListener(onTabRemoved);
          browser.webNavigation.onCompleted.removeListener(onCompleted);
        }

        function onTabRemoved(tabId)
        {
          if (tabId == popupTabId)
          {
            removeListeners();
            Popup.current = null;
            resolve(true);
          }
        }

        function onCompleted(details)
        {
          if (details.tabId == popupTabId &&
              details.frameId == 0 &&
              details.url != "about:blank")
          {
            removeListeners();
            resolve(false);
          }
        }

        browser.tabs.onRemoved.addListener(onTabRemoved);
        browser.webNavigation.onCompleted.addListener(onCompleted);
      }, reject);
    });

    Popup.current = this;
  }

  static removeCurrent()
  {
    if (Popup.current)
    {
      Popup.current.created.then(browser.tabs.remove);
      Popup.current = null;
    }
  }
}

export function setMinTimeout(runnable, timeout)
{
  if (runnable.timeout() < timeout)
    runnable.timeout(timeout);
}

export async function waitForInvisibleElement(tabId, id)
{
  let code = `var el = document.getElementById("${id}");
              el.offsetParent ? el.outerHTML : null`;
  await wait(
    async() => (await browser.tabs.executeScript(tabId, {code}))[0] == null,
    1000,
    `The element with id "${id}" is still visible`
  );
}

export function wait(condition, timeout = 0, message, pollTimeout = 100)
{
  if (typeof condition !== "function")
    throw TypeError("Wait condition must be a function");

  function evaluateCondition()
  {
    return new Promise((resolve, reject) =>
    {
      try
      {
        resolve(condition(this));
      }
      catch (ex)
      {
        reject(ex);
      }
    });
  }

  let result = new Promise((resolve, reject) =>
  {
    let startTime = Date.now();
    let pollCondition = async() =>
    {
      evaluateCondition().then(value =>
      {
        let elapsed = Date.now() - startTime;
        if (value)
        {
          resolve(value);
        }
        else if (timeout && elapsed >= timeout)
        {
          try
          {
            let timeoutMessage = message ?
              `${typeof message === "function" ? message() : message}\n` : "";
            reject(
              new Error(`${timeoutMessage}Wait timed out after ${elapsed}ms`)
            );
          }
          catch (ex)
          {
            reject(
              new Error(`${ex.message}\nWait timed out after ${elapsed}ms`)
            );
          }
        }
        else
        {
          setTimeout(pollCondition, pollTimeout);
        }
      }, reject);
    };
    pollCondition();
  });

  return result;
}

export async function waitForSnippetBlocked(page)
{
  let tabId = await new Page(page).loaded();

  let code = "document.documentElement.dataset.blocked;";
  let blocked;
  await wait(async() =>
  {
    blocked = (await browser.tabs.executeScript(tabId, {code}))[0];
    return blocked != null;
  }, 2000);

  return {blocked, tabId};
}

export function isFirefox()
{
  return typeof netscape != "undefined";
}

export function isOldestFirefox()
{
  if (!isFirefox())
    return false;

  let version = /\brv:([^;)]+)/.exec(navigator.userAgent)[1];
  return parseInt(version, 10) < RECENT_FIREFOX_VERSION;
}

export function isEdge()
{
  return window.navigator.userAgent.includes("Edg/");
}
