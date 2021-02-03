const TEST_PAGES_URL = "http://localhost:3000";
const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";

describe("Blocking", () =>
{
  let currentPage;
  let currentResource;
  let ABP;
  let restoreSubscriptions;

  function onErrorOccurred(details)
  {
    if (currentResource && currentResource.matches(details))
      currentResource.onRequestFinished(details);
  }

  function onCompleted(details)
  {
    if (currentResource && currentResource.matches(details))
      currentResource.onRequestFinished();
  }

  class Page
  {
    constructor(path)
    {
      this.created = (async() =>
      {
        let url = `${TEST_PAGES_URL}/${path}`;
        let tabId;

        if (currentPage)
        {
          ({tabId} = await currentPage.created);
          await browser.tabs.update(tabId, {url});
        }
        else
        {
          tabId = (await browser.tabs.create({url, active: false})).id;
        }

        this.tabId = tabId;
        currentPage = this;
        return this;
      })();
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
  }

  class Resource
  {
    constructor(path, page)
    {
      this.url = `${TEST_PAGES_URL}/${path}`;
      this.page = page;
      this.error = new Promise(resolve =>
      {
        this.onRequestFinished = resolve;
      });

      currentResource = this;
    }

    matches(details)
    {
      if (!this.page || this.page.tabId == details.tabId)
      {
        let url = new URL(details.url);
        if (url.origin + url.pathname == this.url)
          return true;
      }
      return false;
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

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.subscriptions.removeAll();

    let filter = {urls: ["<all_urls>"]};
    browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);
    browser.webRequest.onCompleted.addListener(onCompleted, filter);
  });

  after(() =>
  {
    browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
    browser.webRequest.onCompleted.removeListener(onCompleted);

    if (restoreSubscriptions)
      restoreSubscriptions();
  });

  afterEach(() =>
  {
    if (currentPage)
    {
      browser.tabs.remove(currentPage.tabId);
      currentPage = null;
    }

    ABP.subscriptions.removeAll();
  });

  it("blocks a request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("does not block an allowlisted request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add("@@/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("does not block a request from document allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await new Page("srcdoc.html").expectResource("image.png").toBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    await new Page("srcdoc.html").expectResource("image.png").toBeLoaded();
  });

  it("handles requests from service workers", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}^$document`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("does not block a request sent by the extension", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async() =>
  {
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  describe("Content-Security-Policy", () =>
  {
    async function checkViolatedDirective(query = "")
    {
      let {tabId} = await new Page(`csp.html${query}`).created;
      let code = "document.documentElement.dataset.violatedDirective";

      while (true)
      {
        let result = (await browser.tabs.executeScript(tabId, {code}))[0];
        if (result)
          return result;
      }
    }

    it("injects header", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });

    it("does not inject header for allowlisted requests by document", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$document`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });

    it("does not inject header for allowlisted requests by sitekey", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toEqual("unset");
    });
  });

  describe("Header-based filtering", () =>
  {
    it("blocks a request", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
    });

    it("does not block an allowlisted request", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}/image.png^`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request allowlisted by header", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}/image.png^$header`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from allowlisted document", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}^$document`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });
  });
});
