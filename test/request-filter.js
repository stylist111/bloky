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
    if (currentResource && currentResource.url == details.url)
      currentResource.onRequestFinished(details);
  }

  function onCompleted(details)
  {
    if (currentResource && currentResource.url == details.url)
      currentResource.onRequestFinished();
  }

  class Page
  {
    constructor(url)
    {
      this.created = new Promise(resolve =>
      {
        browser.tabs.create({url: `${TEST_PAGES_URL}/${url}`,
                             active: false}).then(tab =>
        {
          if (currentPage)
            browser.tabs.remove(currentPage.tabId);

          this.tabId = tab.id;
          currentPage = this;
          resolve(this);
        });
      });
    }
  }

  class Resource
  {
    constructor(url)
    {
      this.url = `${TEST_PAGES_URL}/${url}`;
      this.error = new Promise(resolve =>
      {
        this.onRequestFinished = resolve;
      });

      currentResource = this;
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
    new Page("image.html");
    await new Resource("image.png").expectToBeBlocked();
  });

  it("does not block an allowlisted request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add("@@/image.png^$image");
    new Page("image.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("does not block a request allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$sitekey=${SITEKEY}`);
    new Page("image.html?sitekey=1");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("does not block a request from document allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    new Page("image.html?sitekey=1");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    new Page("srcdoc.html");
    await new Resource("image.png").expectToBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    new Page("srcdoc.html");
    await new Resource("image.png").expectToBeLoaded();
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
    new Page("image.html");
    await new Resource("image.png").expectToBeLoaded();
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
});
