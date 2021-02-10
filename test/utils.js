export const TEST_PAGES_URL = "http://localhost:3000";

export class Page
{
  constructor(path)
  {
    this.created = (async() =>
    {
      let url = `${TEST_PAGES_URL}/${path}`;
      let tabId;

      if (Page.current)
      {
        tabId = await Page.current.created;
        await browser.tabs.update(tabId, {url});
      }
      else
      {
        tabId = (await browser.tabs.create({url, active: false})).id;
      }

      return tabId;
    })();

    Page.current = this;
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

export class PopupOpener
{
  constructor()
  {
    this.created = new Page("popup-opener.html").created;
  }

  async openPopup(id)
  {
    let tabId = await this.created;
    let blocked = this.isPopupBlocked();
    let code = `document.getElementById("${id}").click()`;
    await browser.tabs.executeScript(tabId, {code});
    return blocked;
  }

  async isPopupBlocked()
  {
    let onTabCreated;
    let onNavTarget;
    let onTabRemoved;
    let onCompleted;

    this.popupTabId = await new Promise(resolve =>
    {
      onTabCreated = tab => resolve(tab.id);
      onNavTarget = details => resolve(details.tabId);

      browser.tabs.onCreated.addListener(onTabCreated);
      browser.webNavigation.onCreatedNavigationTarget.addListener(onNavTarget);
    });

    browser.tabs.onCreated.removeListener(onTabCreated);
    browser.webNavigation.onCreatedNavigationTarget.removeListener(onNavTarget);

    let blocked = await new Promise(resolve =>
    {
      onTabRemoved = tabId =>
      {
        if (tabId == this.popupTabId)
        {
          this.popupTabId = null;
          resolve(true);
        }
      };

      onCompleted = details =>
      {
        if (details.tabId == this.popupTabId &&
          details.frameId == 0 &&
          details.url != "about:blank")
          resolve(false);
      };

      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.webNavigation.onCompleted.addListener(onCompleted);
    });

    browser.tabs.onRemoved.removeListener(onTabRemoved);
    browser.webNavigation.onCompleted.removeListener(onCompleted);

    return blocked;
  }

  close()
  {
    Page.removeCurrent();
  }

  closePopup()
  {
    if (this.popupTabId)
    {
      browser.tabs.remove(this.popupTabId);
      this.popupTabId = null;
    }
  }
}
