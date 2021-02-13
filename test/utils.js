/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

export const TEST_PAGES_URL = "http://localhost:3000";
export const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                       "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                       "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";

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

    return new Promise(resolve =>
    {
      function onCompleted(details)
      {
        if (details.tabId == tabId && details.frameId == 0)
        {
          browser.webNavigation.onCompleted.removeListener(onCompleted);
          resolve(tabId);
        }
      }
      browser.webNavigation.onCompleted.addListener(onCompleted);
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
      let url = `${TEST_PAGES_URL}/${path}`;
      let onErrorOccurred;
      let onCompleted;

      function matches(details)
      {
        let requestUrl = new URL(details.url);
        return requestUrl.origin + requestUrl.pathname == url;
      }

      let error = await new Promise(resolve =>
      {
        let filter = {urls: ["<all_urls>"], tabId};

        onErrorOccurred = details => matches(details) && resolve(details);
        onCompleted = details => matches(details) && resolve();

        browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);
        browser.webRequest.onCompleted.addListener(onCompleted, filter);
      });

      browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
      browser.webRequest.onCompleted.removeListener(onCompleted);

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

        let code = `document.getElementById("${id}").click()`;
        browser.tabs.executeScript(openerTabId, {code}).catch(err =>
        {
          removeListeners();
          reject(err);
        });

        browser.tabs.onCreated.addListener(onTabCreated);
        onCreatedNavigationTarget.addListener(onNavigationTarget);
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
